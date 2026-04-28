import numpy as np
import pandas as pd
import tensorflow as tf
from keras.models import Sequential
from keras.layers import Conv1D, GlobalAveragePooling1D, Dense, Dropout, BatchNormalization
from keras.optimizers import Adam
from keras.callbacks import EarlyStopping, ReduceLROnPlateau
from keras.regularizers import l2
from sklearn.preprocessing import LabelEncoder
import os
import pickle
from wbo_filter import WBOFilter

class MLModel:
    def __init__(self, csv_path):
        self.csv_path = csv_path
        self.model = None
        self.label_encoder = LabelEncoder()

    def train_model(self):
        data = pd.read_csv(self.csv_path)

        train_data = data[data["split"] == "train"]
        val_data = data[data["split"] == "test"]

        X_train_raw = train_data.drop(columns=["label", "split"]).values.astype("float32")
        y_train_raw = train_data["label"].values

        X_val_raw = val_data.drop(columns=["label", "split"]).values.astype("float32")
        y_val_raw = val_data["label"].values

        # fit scaler trên train thôi
        X_min = np.min(X_train_raw, axis=0)
        X_max = np.max(X_train_raw, axis=0)

        X_train = (X_train_raw - X_min) / (X_max - X_min + 1e-6)
        X_val = (X_val_raw - X_min) / (X_max - X_min + 1e-6)

        # reshape về (time_steps=10, features=10)
        X_train = X_train.reshape(-1, 10, 10)
        X_val = X_val.reshape(-1, 10, 10)

        self.label_encoder.fit(data["label"].values)
        y_train = self.label_encoder.transform(y_train_raw)
        y_val = self.label_encoder.transform(y_val_raw)

        num_classes = len(self.label_encoder.classes_)
        y_train = tf.keras.utils.to_categorical(y_train, num_classes=num_classes)
        y_val = tf.keras.utils.to_categorical(y_val, num_classes=num_classes)

        self.model = Sequential([
            Conv1D(32, kernel_size=3, padding="same", activation="relu",
                   kernel_regularizer=l2(1e-4), input_shape=(10, 10)),
            BatchNormalization(),
            Dropout(0.25),

            Conv1D(64, kernel_size=3, padding="same", activation="relu",
                   kernel_regularizer=l2(1e-4)),
            BatchNormalization(),
            Dropout(0.30),

            GlobalAveragePooling1D(),

            Dense(64, activation="relu", kernel_regularizer=l2(1e-4)),
            Dropout(0.35),

            Dense(num_classes, activation="softmax")
        ])

        opt = Adam(learning_rate=5e-4)

        self.model.compile(
            optimizer=opt,
            loss=tf.keras.losses.CategoricalCrossentropy(label_smoothing=0.05),
            metrics=["accuracy"]
        )

        early_stopping = EarlyStopping(
            monitor="val_loss",
            patience=8,
            restore_best_weights=True
        )

        reduce_lr = ReduceLROnPlateau(
            monitor="val_loss",
            factor=0.5,
            patience=3,
            min_lr=1e-5,
            verbose=1
        )

        history = self.model.fit(
            X_train, y_train,
            epochs=60,
            batch_size=32,
            validation_data=(X_val, y_val),
            callbacks=[early_stopping, reduce_lr],
            verbose=1
        )

        self.save_model(X_min, X_max)
        return history.history["accuracy"][-1], history.history["val_accuracy"][-1]

    def save_model(self, X_min, X_max):
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        model_dir = os.path.join(BASE_DIR, "model")
        os.makedirs(model_dir, exist_ok=True)

        self.model.save(os.path.join(model_dir, "ml_model.keras"))
        with open(os.path.join(model_dir, "model_meta.pkl"), "wb") as f:
            pickle.dump({
                "label_encoder": self.label_encoder,
                "X_min": X_min,
                "X_max": X_max
            }, f)

    def load_saved_model(self):
        BASE_DIR = os.path.dirname(os.path.abspath(__file__))
        model_dir = os.path.join(BASE_DIR, "model")
        
        # Load Model Keras lên RAM 1 lần duy nhất khi khởi động server
        self.model = tf.keras.models.load_model(os.path.join(model_dir, "ml_model.keras"))
        
        # Load các thông số scale và label encoder
        with open(os.path.join(model_dir, "model_meta.pkl"), "rb") as f:
            meta = pickle.load(f)
            self.label_encoder = meta["label_encoder"]
            self.X_min = meta["X_min"]
            self.X_max = meta["X_max"]
            
        print("✅ AI Model Loaded successfully!")

    def predict_realtime(self, window_data):
            """Hàm này nhận 1 mảng 10x10 từ MQTT, LỌC WBO, chuẩn hóa và đưa AI phán đoán"""
            
            # Tạo một bản sao để tránh làm hỏng dữ liệu gốc trong Buffer
            filtered_window = np.copy(window_data)
            
            # BƯỚC MỚI: ÁP DỤNG WBO FILTER CHO 8 CỘT SÓNG (Bỏ qua 2 cột từ trường)
            # 8 cột sóng tương ứng với index từ 0 đến 7 trong features
            for col_idx in range(8):
                col_data = filtered_window[:, col_idx]
                min_val = int(round(np.min(col_data)))
                max_val = int(round(np.max(col_data)))
                
                # Chỉ lọc nếu có sự dao động sóng (min khác max)
                if min_val != max_val:
                    wbo = WBOFilter(min_val, max_val)
                    filtered_window[:, col_idx] = [wbo.proposed_filter(int(round(val))) for val in col_data]

            # 1. Chuẩn hóa bằng đúng X_min, X_max lúc train (áp dụng lên data ĐÃ LỌC)
            X_scaled = (filtered_window - self.X_min) / (self.X_max - self.X_min + 1e-6)
            
            # 2. Reshape về đúng chuẩn (1 batch, 10 timesteps, 10 features)
            X_input = X_scaled.reshape(1, 10, 10)
            
            # 3. Dự đoán (verbose=0 để không in log rác ra terminal)
            pred_probs = self.model.predict(X_input, verbose=0)
            
            # 4. Lấy kết quả cao nhất
            pred_idx = np.argmax(pred_probs, axis=1)[0]
            accuracy = float(np.max(pred_probs)) # Độ tự tin của AI (0 -> 1)
            
            label = self.label_encoder.inverse_transform([pred_idx])[0]
            
            # Tách chuỗi "x_y" thành 2 số riêng biệt
            x_str, y_str = label.split("_")
            return float(x_str), float(y_str), accuracy