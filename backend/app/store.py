from itertools import count
from threading import Lock

from .models import Vendor, VendorCreate


class VendorStore:
    """In-memory vendor storage."""

    def __init__(self) -> None:
        self._vendors: list[Vendor] = []
        self._ids = count(1)
        self._lock = Lock()

    def add(self, payload: VendorCreate) -> Vendor:
        with self._lock:
            vendor = Vendor(id=next(self._ids), **payload.model_dump())
            self._vendors.append(vendor)
            return vendor

    def list(self) -> list[Vendor]:
        with self._lock:
            return list(self._vendors)

    def clear(self) -> None:
        with self._lock:
            self._vendors.clear()


store = VendorStore()
