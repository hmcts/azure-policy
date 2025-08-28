variable "env" {
  default = "sbox"
}

variable "product" {
  default = "azure-policy"
}

variable "location" {
  default = "uksouth"
}

variable "builtFrom" {
  default = "hmcts/cpp-azure-policy"
}

variable "tenant" {
  default = "CNP_SBOX"
}

variable "management_group" {
  type    = string
  default = "/providers/Microsoft.Management/managementGroups/HMCTS"
}

variable "name_suffix" {
  type    = string
  default = ""
}