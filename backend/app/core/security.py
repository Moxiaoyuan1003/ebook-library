import base64
import hashlib

from cryptography.fernet import Fernet


class SecurityManager:
    """Manages API key encryption/decryption."""

    def __init__(self, master_key: str = "default-key-change-in-production"):
        key = hashlib.sha256(master_key.encode()).digest()
        self._fernet = Fernet(base64.urlsafe_b64encode(key))

    def encrypt(self, plaintext: str) -> str:
        """Encrypt a string."""
        return self._fernet.encrypt(plaintext.encode()).decode()

    def decrypt(self, ciphertext: str) -> str:
        """Decrypt a string."""
        return self._fernet.decrypt(ciphertext.encode()).decode()
