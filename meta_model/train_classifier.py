"""
Meta Classifier Training
========================
Trains multiple classifiers on the feature consistency score vectors
to distinguish clean from adversarial images.

Models:
- Logistic Regression
- Random Forest
- Gradient Boosting
- Small MLP

Evaluation metrics: accuracy, precision, recall, F1, ROC-AUC
Outputs: best model saved as .pkl, ROC curves as .png
"""

import os
import numpy as np
import matplotlib.pyplot as plt
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.neural_network import MLPClassifier
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score,
    roc_auc_score, roc_curve, classification_report
)
import joblib


def train_classifier(dataset_path=None, output_dir=None, test_size=0.2, random_state=42):
    """
    Train and evaluate multiple meta-classifiers.
    
    Args:
        dataset_path: path to score_dataset.npz
        output_dir: directory to save models and plots
        test_size: fraction for test split (default: 0.2)
        random_state: random seed for reproducibility
    
    Returns:
        results: dict of {model_name: metrics_dict}
        best_model_name: name of the best performing model
    """
    if dataset_path is None:
        dataset_path = os.path.join("outputs", "score_dataset.npz")
    
    if output_dir is None:
        output_dir = "outputs"
    
    os.makedirs(output_dir, exist_ok=True)
    
    print("=" * 60)
    print("Meta-Classifier Training")
    print("=" * 60)
    
    # --- Load dataset ---
    print("\n[1/4] Loading dataset...")
    data = np.load(dataset_path)
    X, y = data["X"], data["y"]
    print(f"Dataset: X={X.shape}, y={y.shape}")
    print(f"Class distribution: clean={np.sum(y == 0)}, adversarial={np.sum(y == 1)}")
    
    # --- Train/test split ---
    print("\n[2/4] Splitting dataset...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=test_size, random_state=random_state, stratify=y
    )
    print(f"Train set: {X_train.shape[0]} samples")
    print(f"Test set:  {X_test.shape[0]} samples")
    
    # --- Standardize features ---
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    # Save the scaler (needed for inference)
    scaler_path = os.path.join(output_dir, "scaler.pkl")
    joblib.dump(scaler, scaler_path)
    print(f"Scaler saved to {scaler_path}")
    
    # --- Define models ---
    models = {
        "Logistic Regression": LogisticRegression(
            max_iter=1000, random_state=random_state
        ),
        "Random Forest": RandomForestClassifier(
            n_estimators=100, random_state=random_state
        ),
        "Gradient Boosting": GradientBoostingClassifier(
            n_estimators=100, random_state=random_state
        ),
        "MLP": MLPClassifier(
            hidden_layer_sizes=(64, 32), max_iter=500, 
            random_state=random_state, early_stopping=True
        ),
    }
    
    # --- Train and evaluate ---
    print("\n[3/4] Training models...")
    results = {}
    best_auc = 0.0
    best_model_name = None
    
    for name, model in models.items():
        print(f"\n{'─' * 40}")
        print(f"Training: {name}")
        print(f"{'─' * 40}")
        
        # Train
        model.fit(X_train_scaled, y_train)
        
        # Predict
        y_pred = model.predict(X_test_scaled)
        y_prob = model.predict_proba(X_test_scaled)[:, 1]
        
        # Metrics
        acc = accuracy_score(y_test, y_pred)
        prec = precision_score(y_test, y_pred)
        rec = recall_score(y_test, y_pred)
        f1 = f1_score(y_test, y_pred)
        auc = roc_auc_score(y_test, y_prob)
        
        results[name] = {
            "accuracy": acc,
            "precision": prec,
            "recall": rec,
            "f1": f1,
            "roc_auc": auc,
            "y_prob": y_prob,
            "model": model,
        }
        
        print(f"  Accuracy:  {acc:.4f}")
        print(f"  Precision: {prec:.4f}")
        print(f"  Recall:    {rec:.4f}")
        print(f"  F1 Score:  {f1:.4f}")
        print(f"  ROC-AUC:   {auc:.4f}")
        
        # Detailed classification report
        print(f"\n  Classification Report:")
        report = classification_report(y_test, y_pred, 
                                        target_names=["Clean", "Adversarial"])
        print(report)
        
        # Track best model
        if auc > best_auc:
            best_auc = auc
            best_model_name = name
    
    # --- Save best model ---
    print(f"\n{'=' * 60}")
    print(f"Best Model: {best_model_name} (ROC-AUC: {best_auc:.4f})")
    print(f"{'=' * 60}")
    
    best_model_path = os.path.join(output_dir, "best_meta_model.pkl")
    joblib.dump(results[best_model_name]["model"], best_model_path)
    print(f"Best model saved to {best_model_path}")
    
    # Save model name for inference
    info_path = os.path.join(output_dir, "model_info.txt")
    with open(info_path, "w") as f:
        f.write(f"best_model={best_model_name}\n")
        f.write(f"roc_auc={best_auc:.4f}\n")
    
    # --- Plot ROC curves ---
    print("\n[4/4] Plotting ROC curves...")
    plot_roc_curves(results, y_test, output_dir)
    
    # --- Summary table ---
    print_summary_table(results)
    
    return results, best_model_name


def plot_roc_curves(results, y_test, output_dir):
    """Plot ROC curves for all models and save as PNG."""
    plt.figure(figsize=(10, 8))
    
    colors = ["#2196F3", "#4CAF50", "#FF9800", "#9C27B0"]
    
    for i, (name, metrics) in enumerate(results.items()):
        fpr, tpr, _ = roc_curve(y_test, metrics["y_prob"])
        auc = metrics["roc_auc"]
        plt.plot(fpr, tpr, color=colors[i % len(colors)], lw=2,
                 label=f"{name} (AUC = {auc:.4f})")
    
    # Diagonal line (random classifier)
    plt.plot([0, 1], [0, 1], "k--", lw=1, alpha=0.5, label="Random (AUC = 0.5000)")
    
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel("False Positive Rate", fontsize=14)
    plt.ylabel("True Positive Rate", fontsize=14)
    plt.title("ROC Curves — Adversarial Detection Meta-Classifiers", fontsize=16)
    plt.legend(loc="lower right", fontsize=12)
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    
    save_path = os.path.join(output_dir, "roc_curves.png")
    plt.savefig(save_path, dpi=150)
    plt.close()
    print(f"ROC curves saved to {save_path}")


def print_summary_table(results):
    """Print a formatted summary table of all model results."""
    print(f"\n{'=' * 70}")
    print(f"{'Model':<25} {'Accuracy':<10} {'Precision':<10} {'Recall':<10} {'F1':<10} {'AUC':<10}")
    print(f"{'=' * 70}")
    
    for name, metrics in results.items():
        print(f"{name:<25} "
              f"{metrics['accuracy']:<10.4f} "
              f"{metrics['precision']:<10.4f} "
              f"{metrics['recall']:<10.4f} "
              f"{metrics['f1']:<10.4f} "
              f"{metrics['roc_auc']:<10.4f}")
    
    print(f"{'=' * 70}")


if __name__ == "__main__":
    train_classifier()
