import os
os.environ["KMP_DUPLICATE_LIB_OK"] = "TRUE"  # Fix OpenMP conflict on Windows/conda

"""
Adversarial Image Detection via Feature Consistency in Vision Transformers
==========================================================================

Main entry point with CLI subcommands:
    python main.py finetune-resnet   # Fine-tune ResNet-18 on CIFAR-10
    python main.py build-dataset     # Build feature consistency score dataset
    python main.py train             # Train meta-classifiers
    python main.py infer <image>     # Detect single image
    python main.py demo              # Run demo on sample images

Two-Model Architecture:
    Attack model:     ResNet-18 (CNN) — generates adversarial examples
    Detection model:  ViT-B/16 (Vision Transformer) — extracts features
"""

import argparse
import sys
import os
import torch
import numpy as np


def cmd_finetune_resnet(args):
    """Fine-tune ResNet-18 on CIFAR-10 dataset."""
    from models.resnet_loader import finetune_resnet
    
    finetune_resnet(
        num_epochs=args.epochs,
        batch_size=args.batch_size,
        lr=args.lr,
    )


def cmd_build_dataset(args):
    """Build feature consistency score dataset."""
    from dataset.build_score_dataset import build_score_dataset
    
    # Check if ResNet-18 weights exist
    resnet_path = os.path.join("outputs", "resnet18_cifar10.pth")
    if not os.path.exists(resnet_path):
        print("[ERROR] ResNet-18 weights not found!")
        print("Please run: python main.py finetune-resnet")
        sys.exit(1)
    
    X, y = build_score_dataset(num_images=args.num_images)
    print(f"\nDataset built successfully!")
    print(f"Shape: X={X.shape}, y={y.shape}")


def cmd_train(args):
    """Train meta-classifiers on the score dataset."""
    from meta_model.train_classifier import train_classifier
    
    dataset_path = os.path.join("outputs", "score_dataset.npz")
    if not os.path.exists(dataset_path):
        print("[ERROR] Score dataset not found!")
        print("Please run: python main.py build-dataset")
        sys.exit(1)
    
    results, best_model = train_classifier(dataset_path=dataset_path)
    print(f"\nTraining complete! Best model: {best_model}")


def cmd_infer(args):
    """Run inference on a single image."""
    from meta_model.inference_classifier import AdversarialDetector
    from torchvision import transforms
    from PIL import Image
    
    # Check if required files exist
    for f in ["outputs/best_meta_model.pkl", "outputs/scaler.pkl"]:
        if not os.path.exists(f):
            print(f"[ERROR] {f} not found!")
            print("Please run: python main.py train")
            sys.exit(1)
    
    # Load image
    image = Image.open(args.image).convert("RGB")
    transform = transforms.ToTensor()
    image_tensor = transform(image)
    
    # Run detection
    detector = AdversarialDetector()
    result = detector.predict(image_tensor)
    
    print(f"\n{'=' * 50}")
    print(f" RESULT: {result['label']}")
    print(f" Confidence: {result['confidence']:.4f}")
    print(f"{'=' * 50}")
    print(f" P(clean):       {result['probabilities']['clean']:.4f}")
    print(f" P(adversarial): {result['probabilities']['adversarial']:.4f}")
    print(f"{'=' * 50}")
    
    detector.cleanup()


def cmd_demo(args):
    """Run demo on sample CIFAR-10 images (clean + adversarial)."""
    from meta_model.inference_classifier import AdversarialDetector
    from models.resnet_loader import load_resnet
    from attacks.fgsm import fgsm_attack
    from attacks.pgd import pgd_attack
    from torchvision import datasets, transforms
    
    # Check if required files exist
    for f in ["outputs/best_meta_model.pkl", "outputs/scaler.pkl"]:
        if not os.path.exists(f):
            print(f"[ERROR] {f} not found!")
            print("Please run: python main.py train")
            sys.exit(1)
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # Load CIFAR-10 test set
    test_dataset = datasets.CIFAR10(
        root="./data", train=False, download=True,
        transform=transforms.ToTensor()
    )
    
    class_names = test_dataset.classes
    
    # Load detector
    detector = AdversarialDetector(device=device)
    
    # Load ResNet-18 for generating adversarial examples
    resnet_model = load_resnet(device=device)
    for param in resnet_model.parameters():
        param.requires_grad = True
    
    print(f"\n{'=' * 60}")
    print(f" ADVERSARIAL DETECTION DEMO")
    print(f"{'=' * 60}")
    
    # Test on 5 random images
    num_demo = args.num_samples if hasattr(args, 'num_samples') else 5
    indices = np.random.choice(len(test_dataset), num_demo, replace=False)
    
    correct = 0
    total = 0
    
    for idx in indices:
        image, label = test_dataset[idx]
        image = image.to(device)
        
        print(f"\n{'─' * 50}")
        print(f"Image {idx} | True class: {class_names[label]}")
        
        # Test clean image
        result_clean = detector.predict(image)
        is_correct_clean = result_clean["prediction"] == 0
        correct += int(is_correct_clean)
        total += 1
        status = "✓" if is_correct_clean else "✗"
        print(f"  Clean:    {result_clean['label']} "
              f"(conf: {result_clean['confidence']:.4f}) [{status}]")
        
        # Test FGSM adversarial
        adv_fgsm = fgsm_attack(resnet_model, image, label)
        result_fgsm = detector.predict(adv_fgsm)
        is_correct_fgsm = result_fgsm["prediction"] == 1
        correct += int(is_correct_fgsm)
        total += 1
        status = "✓" if is_correct_fgsm else "✗"
        print(f"  FGSM:     {result_fgsm['label']} "
              f"(conf: {result_fgsm['confidence']:.4f}) [{status}]")
        
        # Test PGD adversarial
        adv_pgd = pgd_attack(resnet_model, image, label)
        result_pgd = detector.predict(adv_pgd)
        is_correct_pgd = result_pgd["prediction"] == 1
        correct += int(is_correct_pgd)
        total += 1
        status = "✓" if is_correct_pgd else "✗"
        print(f"  PGD:      {result_pgd['label']} "
              f"(conf: {result_pgd['confidence']:.4f}) [{status}]")
    
    print(f"\n{'=' * 60}")
    print(f" Demo Accuracy: {correct}/{total} = {100*correct/total:.1f}%")
    print(f"{'=' * 60}")
    
    detector.cleanup()


def main():
    parser = argparse.ArgumentParser(
        description="Adversarial Image Detection via Feature Consistency in ViT",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py finetune-resnet              # Step 1: Fine-tune ResNet-18
  python main.py build-dataset                # Step 2: Build score dataset
  python main.py build-dataset --num-images 10  # Quick test with 10 images
  python main.py train                        # Step 3: Train meta-classifier
  python main.py demo                         # Step 4: Run demo
  python main.py infer --image photo.png      # Detect specific image
        """
    )
    
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # finetune-resnet
    p_finetune = subparsers.add_parser("finetune-resnet", 
                                        help="Fine-tune ResNet-18 on CIFAR-10")
    p_finetune.add_argument("--epochs", type=int, default=10,
                           help="Number of training epochs (default: 10)")
    p_finetune.add_argument("--batch-size", type=int, default=128,
                           help="Training batch size (default: 128)")
    p_finetune.add_argument("--lr", type=float, default=0.001,
                           help="Learning rate (default: 0.001)")
    
    # build-dataset
    p_build = subparsers.add_parser("build-dataset", 
                                     help="Build feature consistency score dataset")
    p_build.add_argument("--num-images", type=int, default=1000,
                        help="Number of clean images to use (default: 1000)")
    
    # train
    p_train = subparsers.add_parser("train", 
                                     help="Train meta-classifiers")
    
    # infer
    p_infer = subparsers.add_parser("infer", 
                                     help="Run inference on a single image")
    p_infer.add_argument("--image", type=str, required=True,
                        help="Path to image file")
    
    # demo
    p_demo = subparsers.add_parser("demo", 
                                    help="Run demo on sample CIFAR-10 images")
    p_demo.add_argument("--num-samples", type=int, default=5,
                       help="Number of sample images (default: 5)")
    
    args = parser.parse_args()
    
    if args.command is None:
        parser.print_help()
        sys.exit(0)
    
    # Print header
    print("╔══════════════════════════════════════════════════════════╗")
    print("║  Adversarial Detection via Feature Consistency in ViT   ║")
    print("║  Attack Model: ResNet-18 │ Detection Model: ViT-B/16   ║")
    print("╚══════════════════════════════════════════════════════════╝")
    
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"Device: {device}")
    if device.type == "cuda":
        print(f"GPU: {torch.cuda.get_device_name(0)}")
    print()
    
    # Dispatch to command handler
    commands = {
        "finetune-resnet": cmd_finetune_resnet,
        "build-dataset": cmd_build_dataset,
        "train": cmd_train,
        "infer": cmd_infer,
        "demo": cmd_demo,
    }
    
    commands[args.command](args)


if __name__ == "__main__":
    main()
