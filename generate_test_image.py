"""
Generate adversarial test images for manual inspection.
Run AFTER ResNet-18 fine-tuning is complete.
"""
import torch
import os
from torchvision import datasets, transforms
from PIL import Image
import numpy as np

# Import attack functions
from models.resnet_loader import load_resnet
from attacks.fgsm import fgsm_attack
from attacks.pgd import pgd_attack

def generate_test_images():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    
    # Check if ResNet-18 is trained
    resnet_path = os.path.join("outputs", "resnet18_cifar10.pth")
    if not os.path.exists(resnet_path):
        print("ERROR: ResNet-18 not trained yet!")
        print("Run: python main.py finetune-resnet")
        return
    
    # Load trained ResNet-18
    model = load_resnet(device=device)
    for param in model.parameters():
        param.requires_grad = True  # Enable gradients for attacks
    
    # Load CIFAR-10 test data
    test_dataset = datasets.CIFAR10(
        root="./data", train=False, download=True,
        transform=transforms.ToTensor()
    )
    class_names = test_dataset.classes
    
    # Pick a test image
    image, label = test_dataset[0]  # First test image
    image = image.to(device)
    
    print(f"Original image class: {class_names[label]}")
    
    # Generate adversarial variants
    adv_fgsm = fgsm_attack(model, image, label)
    adv_pgd = pgd_attack(model, image, label)
    
    # Save images
    os.makedirs("test_images", exist_ok=True)
    
    def save_tensor_as_image(tensor, filename):
        # Convert CHW tensor to HWC numpy array
        img_array = tensor.cpu().numpy().transpose(1, 2, 0)
        img_array = (img_array * 255).astype(np.uint8)
        img = Image.fromarray(img_array)
        img.save(filename)
        print(f"Saved: {filename}")
    
    save_tensor_as_image(image, "test_images/clean_image.png")
    save_tensor_as_image(adv_fgsm, "test_images/adversarial_fgsm.png")
    save_tensor_as_image(adv_pgd, "test_images/adversarial_pgd.png")
    
    print("\nGenerated test images in 'test_images/' folder:")
    print("  clean_image.png       <- Should detect as CLEAN")
    print("  adversarial_fgsm.png  <- Should detect as ADVERSARIAL") 
    print("  adversarial_pgd.png   <- Should detect as ADVERSARIAL")
    
    print(f"\nTo test detection:")
    print(f"  python main.py infer --image test_images/clean_image.png")
    print(f"  python main.py infer --image test_images/adversarial_fgsm.png")

if __name__ == "__main__":
    generate_test_images()