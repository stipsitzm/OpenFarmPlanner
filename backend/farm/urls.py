from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    LocationViewSet,
    SupplierViewSet,
    FieldViewSet,
    BedViewSet,
    CultureViewSet,
    PlantingPlanViewSet,
    TaskViewSet,
    SeedDemandListView,
    YieldCalendarListView,
    NoteAttachmentListCreateView,
    NoteAttachmentDeleteView,
    MediaFileUploadView,
    GlobalHistoryListView,
    GlobalHistoryRestoreView,
    ProjectHistoryListView,
    ProjectHistoryRestoreView,
    CultureUndeleteView,
    SeedPackageViewSet,
    BedLayoutByLocationView,
    ProjectViewSet,
    MyProjectsView,
    ProjectSwitchView,
    ProjectMembersView,
    ProjectInvitationView,
    PublicProjectInvitationView,
    PendingProjectInvitationView,
    AcceptProjectInvitationView,
    AcceptProjectInvitationByTokenView,
    AcceptPendingProjectInvitationView,
    RevokeProjectInvitationView,
)

router = DefaultRouter()
router.register(r'locations', LocationViewSet)
router.register(r'suppliers', SupplierViewSet)
router.register(r'fields', FieldViewSet)
router.register(r'beds', BedViewSet)
router.register(r'cultures', CultureViewSet)
router.register(r'seed-packages', SeedPackageViewSet)
router.register(r'planting-plans', PlantingPlanViewSet)
router.register(r'tasks', TaskViewSet)
router.register(r'projects', ProjectViewSet, basename='projects')

urlpatterns = [
    path('history/project/', ProjectHistoryListView.as_view(), name='project-history-list'),
    path('history/project/restore/', ProjectHistoryRestoreView.as_view(), name='project-history-restore'),
    path('cultures/<int:pk>/undelete/', CultureUndeleteView.as_view(), name='culture-undelete'),
    path('history/global/', GlobalHistoryListView.as_view(), name='global-history-list'),
    path('history/global/restore/', GlobalHistoryRestoreView.as_view(), name='global-history-restore'),
    path('media-files/upload/', MediaFileUploadView.as_view(), name='media-file-upload'),
    path('notes/<int:note_id>/attachments/', NoteAttachmentListCreateView.as_view(), name='note-attachments'),
    path('attachments/<int:attachment_id>/', NoteAttachmentDeleteView.as_view(), name='note-attachment-delete'),
    path('seed-demand/', SeedDemandListView.as_view(), name='seed-demand-list'),
    path('yield-calendar/', YieldCalendarListView.as_view(), name='yield-calendar-list'),
    path('locations/<int:location_id>/layouts/', BedLayoutByLocationView.as_view(), name='location-layouts'),
    path('projects-bootstrap/', MyProjectsView.as_view(), name='projects-bootstrap'),
    path('projects-switch/', ProjectSwitchView.as_view(), name='projects-switch'),
    path('projects/<int:project_id>/members/', ProjectMembersView.as_view(), name='project-members'),
    path('projects/<int:project_id>/invitations/', ProjectInvitationView.as_view(), name='project-invitations'),
    path('projects/<int:project_id>/invitations/<int:invitation_id>/revoke/', RevokeProjectInvitationView.as_view(), name='project-invitations-revoke'),
    path('invitations/accept/', AcceptProjectInvitationView.as_view(), name='invitations-accept'),
    path('project-invitations/accept/', AcceptProjectInvitationView.as_view(), name='project-invitations-accept'),
    path('project-invitations/pending/', PendingProjectInvitationView.as_view(), name='project-invitations-pending'),
    path('project-invitations/pending/accept/', AcceptPendingProjectInvitationView.as_view(), name='project-invitations-pending-accept'),
    path('project-invitations/<str:token>/accept/', AcceptProjectInvitationByTokenView.as_view(), name='project-invitations-token-accept'),
    path('project-invitations/<str:token>/', PublicProjectInvitationView.as_view(), name='project-invitations-public'),
    path('', include(router.urls)),
]
