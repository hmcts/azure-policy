terraform {
  required_version = ">= 1.12.2"

  backend "azurerm" {
    container_name = "cpp-azure-policy"
    key            = "terraform.tfstate"
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "4.40.0"
    }
  }
}

provider "azurerm" {
  features {}
}
