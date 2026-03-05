"""
Score Dataset Builder
=====================
Builds the feature consistency score dataset for training the meta-classifier.

Pipeline:
1. Load CIFAR-10 test set (configurable subset)
2. Load ResNet-18 (attack model) and ViT-B/16 (detection model)
3. For each image:
   - Compute score vector for clean image → label = 0
   - Generate FGSM adversarial via ResNet-18 → compute score vector via ViT → label = 1
   - Generate PGD adversarial via ResNet-18 → compute score vector via ViT → label = 1
4. Save as .npz file with X (feature vectors) and y (labels)
"""

import os
import numpy as np
import torch
from torchvision import datasets, transforms
from tqdm import tqdm

from models.vit_loader import load_vit
from models.resnet_loader import load_resnet
from features.feature_distance import compute_score_vector
from attacks.fgsm import fgsm_attack
from attacks.pgd import pgd_attack


def build_score_dataset(num_images=1000, save_path=None, device=None,
                         dataset_name="cifar10", resnet_weights_path=None):
    """
    Build the feature consistency score dataset.
    
    Args:
        num_images: number of clean images to use (default: 1000)
                    Total samples = num_images × 3 (clean + FGSM + PGD)
        save_path: path to save the .npz file 
                   (default: outputs/score_dataset.npz)
        device: torch device
        dataset_name: 'cifar10' or 'cifar100' (default: 'cifar10')
        resnet_weights_path: path to ResNet-18 checkpoint (overrides default)
    
    Returns:
        X: numpy array of shape (num_images * 3, 24) — score vectors
        y: numpy array of shape (num_images * 3,) — labels (0=clean, 1=adversarial)
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda_is_available() else "cpu")
    
    if save_path is None:
        save_path = os.path.join("outputs", "score_dataset.npz")
    
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    dataset_name = dataset_name.lower()
    num_classes = 100 if dataset_name == "cifar100" else 10
    
    print("=" * 60)
    print("Building Feature Consistency Score Dataset")
    print("=" * 60)
    print(f"Device: {device}")
    print(f"Dataset: {dataset_name.upper()} ({num_classes} classes)")
    print(f"Number of images: {num_images}")
    print(f"Expected samples: {num_images * 3} (clean + FGSM + PGD)")
    print()
    
    # --- Load models ---
    print("[1/4] Loading models...")
    
    # ViT — detection model (feature extraction)
    vit_model, hook_dict, hook_handles = load_vit(device=device)
    
    # ResNet-18 — attack model (adversarial generation)
    resnet_model = load_resnet(
        num_classes=num_classes,
        weights_path=resnet_weights_path,
        device=device
    )
    # Temporarily enable gradients for attack generation
    for param in resnet_model.parameters():
        param.requires_grad = True
    
    print()
    
    # --- Load CIFAR-10 test set ---
    print("[2/4] Loading CIFAR-10 test set...")
    
    test_transform = transforms.Compose([
        transforms.ToTensor(),  # Converts to [0, 1] range
    ])
    
    # Load the appropriate dataset (CIFAR-10 or CIFAR-100)
    if dataset_name == "cifar100":
        from torchvision.datasets import CIFAR100 as CIFARDataset
    else:
        from torchvision.datasets import CIFAR10 as CIFARDataset
    
    test_dataset = CIFARDataset(
        root="./data", train=False, download=True, transform=test_transform
    )
    
    # Select a balanced subset: equal images per class
    num_classes = 10
    images_per_class = num_images // num_classes
    
    # Group indices by class
    class_indices = {i: [] for i in range(num_classes)}
    for idx in range(len(test_dataset)):
        _, label = test_dataset[idx]
        if len(class_indices[label]) < images_per_class:
            class_indices[label].append(idx)
    
    # Flatten to get selected indices
    selected_indices = []
    for cls in range(num_classes):
        selected_indices.extend(class_indices[cls][:images_per_class])
    
    actual_num = len(selected_indices)
    print(f"Selected {actual_num} images ({images_per_class} per class)")
    print()
    
    # --- Compute score vectors ---
    print("[3/4] Computing score vectors...")
    
    all_scores = []
    all_labels = []
    
    for i, idx in enumerate(tqdm(selected_indices, desc="Processing images")):
        image, label = test_dataset[idx]
        image = image.to(device)
        
        # --- Clean image score vector (label = 0) ---
        clean_score = compute_score_vector(vit_model, image, hook_dict)
        all_scores.append(clean_score)
        all_labels.append(0)
        
        # --- FGSM adversarial score vector (label = 1) ---
        try:
            adv_fgsm = fgsm_attack(resnet_model, image, label)
            fgsm_score = compute_score_vector(vit_model, adv_fgsm, hook_dict)
            all_scores.append(fgsm_score)
            all_labels.append(1)
        except Exception as e:
            print(f"\n[WARNING] FGSM failed for image {idx}: {e}")
            # Add zero vector as fallback
            all_scores.append([0.0] * len(clean_score))
            all_labels.append(1)
        
        # --- PGD adversarial score vector (label = 1) ---
        try:
            adv_pgd = pgd_attack(resnet_model, image, label)
            pgd_score = compute_score_vector(vit_model, adv_pgd, hook_dict)
            all_scores.append(pgd_score)
            all_labels.append(1)
        except Exception as e:
            print(f"\n[WARNING] PGD failed for image {idx}: {e}")
            all_scores.append([0.0] * len(clean_score))
            all_labels.append(1)
    
    # Convert to numpy arrays
    X = np.array(all_scores, dtype=np.float32)
    y = np.array(all_labels, dtype=np.int32)
    
    print(f"\nDataset shape: X={X.shape}, y={y.shape}")
    print(f"Clean samples: {np.sum(y == 0)}")
    print(f"Adversarial samples: {np.sum(y == 1)}")
    
    # --- Save dataset ---
    print(f"\n[4/4] Saving dataset to {save_path}")
    np.savez(save_path, X=X, y=y)
    print(f"Dataset saved! File size: {os.path.getsize(save_path) / 1024:.1f} KB")
    
    # Cleanup hooks
    from models.vit_loader import remove_hooks
    remove_hooks(hook_handles)
    
    return X, y


if __name__ == "__main__":
    build_score_dataset(num_images=1000)
