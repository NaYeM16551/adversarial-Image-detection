"""
Inference Classifier
====================
Loads the trained meta-classifier and predicts whether a given 
image is CLEAN or ADVERSARIAL based on its feature consistency 
score vector.

Pipeline:
1. Load saved meta-classifier and scaler
2. Compute score vector for input image using ViT
3. Scale the score vector
4. Predict: 0 = CLEAN, 1 = ADVERSARIAL
"""

import os
import numpy as np
import torch
import joblib

from models.vit_loader import load_vit, remove_hooks
from features.feature_distance import compute_score_vector


class AdversarialDetector:
    """
    End-to-end adversarial image detector.
    
    Uses a pretrained ViT for feature extraction and a trained
    meta-classifier for clean/adversarial prediction.
    """
    
    def __init__(self, model_path=None, scaler_path=None, device=None):
        """
        Initialize the detector.
        
        Args:
            model_path: path to the trained meta-classifier (.pkl)
            scaler_path: path to the fitted scaler (.pkl)
            device: torch device for ViT
        """
        if model_path is None:
            model_path = os.path.join("outputs", "best_meta_model.pkl")
        if scaler_path is None:
            scaler_path = os.path.join("outputs", "scaler.pkl")
        
        # Load meta-classifier
        self.classifier = joblib.load(model_path)
        print(f"[Detector] Loaded classifier from {model_path}")
        
        # Load scaler
        self.scaler = joblib.load(scaler_path)
        print(f"[Detector] Loaded scaler from {scaler_path}")
        
        # Load ViT detection model
        self.vit_model, self.hook_dict, self.hook_handles = load_vit(device=device)
        self.device = device or torch.device("cuda" if torch.cuda.is_available() else "cpu")
        
        print("[Detector] Ready for inference!")
    
    def predict(self, image_tensor):
        """
        Predict whether an image is clean or adversarial.
        
        Args:
            image_tensor: (C, H, W) tensor in [0, 1] range
        
        Returns:
            dict with:
                - label: "CLEAN IMAGE" or "ADVERSARIAL IMAGE"
                - confidence: probability score
                - score_vector: raw 24-dim feature vector
        """
        # Compute feature consistency score vector
        score_vector = compute_score_vector(
            self.vit_model, image_tensor, self.hook_dict
        )
        
        # Scale features
        score_array = np.array(score_vector, dtype=np.float32).reshape(1, -1)
        score_scaled = self.scaler.transform(score_array)
        
        # Predict
        prediction = self.classifier.predict(score_scaled)[0]
        confidence = self.classifier.predict_proba(score_scaled)[0]
        
        label = "ADVERSARIAL IMAGE" if prediction == 1 else "CLEAN IMAGE"
        conf_score = confidence[prediction]
        
        return {
            "label": label,
            "confidence": float(conf_score),
            "prediction": int(prediction),
            "score_vector": score_vector,
            "probabilities": {
                "clean": float(confidence[0]),
                "adversarial": float(confidence[1]),
            }
        }
    
    def cleanup(self):
        """Remove ViT hooks and free resources."""
        remove_hooks(self.hook_handles)
        print("[Detector] Cleaned up.")


def run_inference(image_tensor, model_path=None, scaler_path=None, device=None):
    """
    Convenience function for single-image inference.
    
    Args:
        image_tensor: (C, H, W) tensor in [0, 1]
        model_path: path to meta-classifier
        scaler_path: path to scaler
        device: torch device
    
    Returns:
        result dict with label, confidence, and score_vector
    """
    detector = AdversarialDetector(model_path, scaler_path, device)
    result = detector.predict(image_tensor)
    detector.cleanup()
    return result
