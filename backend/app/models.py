from enum import Enum

from pydantic import BaseModel, EmailStr, Field


class VendorCategory(str, Enum):
    STAFFING_AGENCY = "Staffing Agency"
    FREELANCE_PLATFORM = "Freelance Platform"
    CONSULTANT = "Consultant"


class VendorStatus(str, Enum):
    PENDING_APPROVAL = "Pending Approval"
    APPROVED = "Approved"
    REJECTED = "Rejected"


class VendorCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    category: VendorCategory
    contact_email: EmailStr
    status: VendorStatus = VendorStatus.PENDING_APPROVAL


class Vendor(VendorCreate):
    id: int
