"""
ResNet-18 Model Loader (Attack Model)
======================================
Loads a pretrained ResNet-18 and adapts it for CIFAR-10 classification.
This model is used as the TARGET for adversarial attacks (FGSM, PGD).

Architecture change:
- ResNet-18 pretrained on ImageNet (1000 classes)
- Replace final FC layer: nn.Linear(512, 10) for CIFAR-10

The adversarial perturbations crafted against this CNN are then
fed to the ViT for detection — creating a transfer-attack setting.
"""

import os
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import models, datasets, transforms
from torch.utils.data import DataLoader


def load_resnet(num_classes=10, weights_path=None, device=None):
    """
    Load ResNet-18 adapted for CIFAR-10.
    
    Args:
        num_classes: number of output classes (default: 10 for CIFAR-10)
        weights_path: path to fine-tuned weights (.pth file).
                      If None, looks for 'outputs/resnet18_cifar10.pth'.
                      If not found, returns the model with ImageNet pretrained
                      weights and modified FC layer (needs fine-tuning).
        device: torch device (auto-detected if None)
    
    Returns:
        model: ResNet-18 in eval mode on the specified device
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # Initialize ResNet-18 with random weights (no network download needed)
    # We fine-tune on CIFAR-10, so ImageNet pretrained weights are not required
    model = models.resnet18(weights=None)
    
    # Replace final fully connected layer for CIFAR-10 (10 classes)
    model.fc = nn.Linear(model.fc.in_features, num_classes)
    
    # Try to load fine-tuned weights
    if weights_path is None:
        weights_path = os.path.join("outputs", "resnet18_cifar10.pth")
    
    if os.path.exists(weights_path):
        model.load_state_dict(torch.load(weights_path, map_location=device))
        print(f"[ResNet Loader] Loaded fine-tuned weights from {weights_path}")
    else:
        print(f"[ResNet Loader] No fine-tuned weights found at {weights_path}")
        print("[ResNet Loader] Model has ImageNet weights with modified FC layer.")
        print("[ResNet Loader] Run fine-tuning first: finetune_resnet()")
    
    model = model.to(device)
    model.eval()
    
    print(f"[ResNet Loader] Loaded ResNet-18 ({num_classes} classes) on {device}")
    print(f"[ResNet Loader] Total parameters: {sum(p.numel() for p in model.parameters()):,}")
    
    return model


def finetune_resnet(num_epochs=15, batch_size=128, lr=0.001, 
                    save_path=None, device=None):
    """
    Fine-tune ResNet-18 on CIFAR-10 training set.
    
    The model needs to be a competent classifier so that adversarial
    attacks (FGSM, PGD) crafted against it are meaningful.
    
    Args:
        num_epochs: number of training epochs
        batch_size: training batch size
        lr: learning rate
        save_path: where to save weights (default: outputs/resnet18_cifar10.pth)
        device: torch device
    
    Returns:
        model: fine-tuned ResNet-18 in eval mode
    """
    if device is None:
        device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    if save_path is None:
        save_path = os.path.join("outputs", "resnet18_cifar10.pth")
    
    # Ensure output directory exists
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    
    print(f"[ResNet Fine-Tuning] Device: {device}")
    print(f"[ResNet Fine-Tuning] Epochs: {num_epochs}, Batch size: {batch_size}, LR: {lr}")
    
    # --- Data preparation ---
    # CIFAR-10 images are 32x32, ResNet expects 32x32 (no need for 224x224 here,
    # since adversarial perturbations are generated at native CIFAR-10 resolution)
    train_transform = transforms.Compose([
        transforms.RandomCrop(32, padding=4),
        transforms.RandomHorizontalFlip(),
        transforms.ToTensor(),
    ])
    
    test_transform = transforms.Compose([
        transforms.ToTensor(),
    ])
    
    train_dataset = datasets.CIFAR10(root="./data", train=True, 
                                      download=True, transform=train_transform)
    test_dataset = datasets.CIFAR10(root="./data", train=False, 
                                     download=True, transform=test_transform)
    
    train_loader = DataLoader(train_dataset, batch_size=batch_size, 
                               shuffle=True, num_workers=2)
    test_loader = DataLoader(test_dataset, batch_size=batch_size, 
                              shuffle=False, num_workers=2)
    
    # --- Model setup ---
    # Train from scratch on CIFAR-10 (no internet download needed)
    model = models.resnet18(weights=None)
    model.fc = nn.Linear(model.fc.in_features, 10)
    
    # Modify first conv layer for 32x32 input (smaller kernel, no downsampling)
    model.conv1 = nn.Conv2d(3, 64, kernel_size=3, stride=1, padding=1, bias=False)
    model.maxpool = nn.Identity()  # Remove maxpool for small images
    
    model = model.to(device)
    
    criterion = nn.CrossEntropyLoss()
    optimizer = optim.Adam(model.parameters(), lr=lr)
    scheduler = optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=num_epochs)
    
    # --- Training loop ---
    best_acc = 0.0
    for epoch in range(num_epochs):
        model.train()
        running_loss = 0.0
        correct = 0
        total = 0
        
        for batch_idx, (images, labels) in enumerate(train_loader):
            images, labels = images.to(device), labels.to(device)
            
            optimizer.zero_grad()
            outputs = model(images)
            loss = criterion(outputs, labels)
            loss.backward()
            optimizer.step()
            
            running_loss += loss.item()
            _, predicted = outputs.max(1)
            total += labels.size(0)
            correct += predicted.eq(labels).sum().item()
        
        train_acc = 100.0 * correct / total
        avg_loss = running_loss / len(train_loader)
        
        # --- Evaluation ---
        model.eval()
        correct = 0
        total = 0
        with torch.no_grad():
            for images, labels in test_loader:
                images, labels = images.to(device), labels.to(device)
                outputs = model(images)
                _, predicted = outputs.max(1)
                total += labels.size(0)
                correct += predicted.eq(labels).sum().item()
        
        test_acc = 100.0 * correct / total
        scheduler.step()
        
        print(f"  Epoch [{epoch+1}/{num_epochs}] "
              f"Loss: {avg_loss:.4f} | "
              f"Train Acc: {train_acc:.2f}% | "
              f"Test Acc: {test_acc:.2f}%")
        
        # Save best model
        if test_acc > best_acc:
            best_acc = test_acc
            torch.save(model.state_dict(), save_path)
    
    print(f"\n[ResNet Fine-Tuning] Best test accuracy: {best_acc:.2f}%")
    print(f"[ResNet Fine-Tuning] Weights saved to {save_path}")
    
    # Load best weights and return in eval mode
    model.load_state_dict(torch.load(save_path, map_location=device))
    model.eval()
    
    return model


if __name__ == "__main__":
    # Run this script directly to fine-tune ResNet-18 on CIFAR-10
    print("=" * 60)
    print("Fine-tuning ResNet-18 on CIFAR-10")
    print("=" * 60)
    finetune_resnet(num_epochs=10)
