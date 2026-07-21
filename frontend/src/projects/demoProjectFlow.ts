import { projectAPI, type ProjectPayload } from '../api/api';

export async function createDemoProjectAndSwitch(
  switchActiveProject: (projectId: number) => Promise<void>,
): Promise<ProjectPayload> {
  const response = await projectAPI.createDemo();
  await switchActiveProject(response.data.id);
  return response.data;
}
