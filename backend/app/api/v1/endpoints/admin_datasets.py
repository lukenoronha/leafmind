"""Admin Dataset Management endpoints (Sprint 6) — upload/replace/delete
medicinal-leaf image dataset classes and view dataset statistics. Admin-only.

Writes directly into the on-disk `datasets/` tree `DatasetLoader` reads for
VLM candidate-label generation; does not modify `DatasetLoader`'s existing
read methods or the inference pipeline.
"""

from fastapi import APIRouter, Depends, File, Form, UploadFile

from app.api.deps import CurrentUserDep, DatasetManagementServiceDep, require_role
from app.models.role import RoleName
from app.schemas.admin import DatasetClassListResponse, DatasetClassResponse, DatasetStatisticsResponse
from app.schemas.auth import MessageResponse

router = APIRouter(
    prefix="/admin/datasets",
    tags=["Admin: Dataset Management"],
    dependencies=[Depends(require_role(RoleName.ADMIN))],
)


@router.get(
    "/statistics",
    response_model=DatasetStatisticsResponse,
    summary="Get dataset statistics",
    description="Total/verified class counts and raw image directory status.",
)
async def get_statistics(
    current_user: CurrentUserDep, service: DatasetManagementServiceDep
) -> DatasetStatisticsResponse:
    return DatasetStatisticsResponse(**service.get_statistics())


@router.get(
    "",
    response_model=DatasetClassListResponse,
    summary="List dataset classes",
)
async def list_classes(
    current_user: CurrentUserDep, service: DatasetManagementServiceDep
) -> DatasetClassListResponse:
    classes = service.list_classes()
    return DatasetClassListResponse(
        items=[
            DatasetClassResponse(
                class_id=c.class_id,
                training_label=c.training_label,
                folder_name=c.folder_name,
                status=c.status,
                display_name=c.display_name,
                is_verified=c.is_verified,
            )
            for c in classes
        ]
    )


@router.post(
    "/upload",
    response_model=DatasetClassResponse,
    summary="Upload or replace a dataset class",
    description="Adds a new class (folder_name + training_label + images), or, "
    "if `replace_existing` is true, clears and replaces an existing class's images. "
    "Invalidates the process-wide dataset taxonomy cache so the change is picked up "
    "without a restart.",
)
async def upload_class(
    current_user: CurrentUserDep,
    service: DatasetManagementServiceDep,
    training_label: str = Form(...),
    folder_name: str = Form(...),
    replace_existing: bool = Form(default=False),
    files: list[UploadFile] = File(...),
) -> DatasetClassResponse:
    images = [(f.filename or "image.jpg", await f.read()) for f in files]
    dataset_class = await service.upload_class(
        actor=current_user,
        training_label=training_label,
        folder_name=folder_name,
        images=images,
        replace_existing=replace_existing,
    )
    return DatasetClassResponse(
        class_id=dataset_class.class_id,
        training_label=dataset_class.training_label,
        folder_name=dataset_class.folder_name,
        status=dataset_class.status,
        display_name=dataset_class.display_name,
        is_verified=dataset_class.is_verified,
    )


@router.delete(
    "/{class_id}",
    response_model=MessageResponse,
    summary="Delete a dataset class",
    description="Removes the class's image folder and its `classes.json` entry, "
    "then invalidates the dataset taxonomy cache.",
)
async def delete_class(
    class_id: int, current_user: CurrentUserDep, service: DatasetManagementServiceDep
) -> MessageResponse:
    await service.delete_class(actor=current_user, class_id=class_id)
    return MessageResponse(message="Dataset class deleted.")
