import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import InvitationAcceptPage from "../pages/InvitationAcceptPage";

const switchActiveProjectMock = vi.fn(async () => {});
const refreshUserMock = vi.fn(async () => null);
const acceptInvitationByTokenMock = vi.fn();
const mockAuthState = {
  user: null as null | { id: number; email: string },
  isLoading: false,
};

function LocationEcho(): React.ReactElement {
  const location = useLocation();
  return <div>{`${location.pathname}${location.search}`}</div>;
}

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({
    user: mockAuthState.user,
    isLoading: mockAuthState.isLoading,
    switchActiveProject: switchActiveProjectMock,
    refreshUser: refreshUserMock,
  }),
}));

vi.mock("../api/api", async () => {
  const actual =
    await vi.importActual<typeof import("../api/api")>("../api/api");
  return {
    ...actual,
    projectAPI: {
      ...actual.projectAPI,
      acceptInvitationByToken: (...args: unknown[]) =>
        acceptInvitationByTokenMock(...args),
    },
  };
});

describe("InvitationAcceptPage", () => {
  beforeEach(() => {
    mockAuthState.user = null;
    mockAuthState.isLoading = false;
    switchActiveProjectMock.mockClear();
    refreshUserMock.mockReset();
    acceptInvitationByTokenMock.mockReset();
    window.localStorage.clear();
  });

  it("redirects anonymous users to login with a next parameter and stores token fallback", async () => {
    render(
      <MemoryRouter initialEntries={["/invite/accept?token=abc123"]}>
        <Routes>
          <Route path="/invite/accept" element={<InvitationAcceptPage />} />
          <Route path="/login" element={<LocationEcho />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(
        screen.getByText("/login?next=%2Finvite%2Faccept%3Ftoken%3Dabc123"),
      ).toBeInTheDocument();
    });
    expect(window.localStorage.getItem("ofp.invitationAcceptToken")).toBe(
      "abc123",
    );
    expect(window.localStorage.getItem("ofp.invitationAcceptNext")).toBe(
      "/invite/accept?token=abc123",
    );
  });


  it("waits for auth bootstrap before redirecting already logged-in invitees", async () => {
    mockAuthState.isLoading = true;
    acceptInvitationByTokenMock.mockResolvedValueOnce({
      data: {
        code: "accepted",
        detail: "Invitation accepted.",
        project_id: 11,
        project: { id: 11, name: "Projekt Süd", slug: "projekt-sued" },
      },
    });

    const { rerender } = render(
      <MemoryRouter initialEntries={["/invite/accept?token=delayed123"]}>
        <Routes>
          <Route path="/invite/accept" element={<InvitationAcceptPage />} />
          <Route path="/login" element={<LocationEcho />} />
          <Route path="/app/anbauplaene" element={<div>Anbaupläne</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(screen.getByText(/Einladung wird angenommen/)).toBeInTheDocument();
    });
    expect(acceptInvitationByTokenMock).not.toHaveBeenCalled();
    expect(screen.queryByText(/\/login\?next=/)).not.toBeInTheDocument();

    mockAuthState.isLoading = false;
    mockAuthState.user = { id: 4, email: "invitee@example.com" };

    rerender(
      <MemoryRouter initialEntries={["/invite/accept?token=delayed123"]}>
        <Routes>
          <Route path="/invite/accept" element={<InvitationAcceptPage />} />
          <Route path="/login" element={<LocationEcho />} />
          <Route path="/app/anbauplaene" element={<div>Anbaupläne</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(acceptInvitationByTokenMock).toHaveBeenCalledWith("delayed123");
    });
    await waitFor(() => {
      expect(switchActiveProjectMock).toHaveBeenCalledWith(11);
    });
  });

  it("accepts the invitation for authenticated users and switches the active project", async () => {
    mockAuthState.user = { id: 1, email: "invitee@example.com" };
    acceptInvitationByTokenMock.mockResolvedValueOnce({
      data: {
        code: "accepted",
        detail: "Invitation accepted.",
        project_id: 7,
        project: { id: 7, name: "Projekt Nord", slug: "projekt-nord" },
      },
    });

    render(
      <MemoryRouter initialEntries={["/invite/accept?token=abc123"]}>
        <Routes>
          <Route path="/invite/accept" element={<InvitationAcceptPage />} />
          <Route path="/app/anbauplaene" element={<div>Anbaupläne</div>} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => {
      expect(acceptInvitationByTokenMock).toHaveBeenCalledWith("abc123");
    });
    await waitFor(() => {
      expect(switchActiveProjectMock).toHaveBeenCalledWith(7);
    });
    expect(refreshUserMock).toHaveBeenCalled();
    expect(
      await screen.findByText("Du wurdest dem Projekt hinzugefügt."),
    ).toBeInTheDocument();
  });
});
