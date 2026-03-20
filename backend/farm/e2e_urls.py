from django.urls import path

from .e2e_views import E2EInvitationFixtureView

urlpatterns = [
    path('__e2e__/invite-flow/', E2EInvitationFixtureView.as_view(), name='e2e-invite-flow'),
]
