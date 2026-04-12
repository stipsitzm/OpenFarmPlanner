import fs from "fs";
import path from "path";

describe("Demo hierarchy English copy", () => {
  test("uses English labels in demo component and app section text", () => {
    const demoHierarchyPath = path.join(
      process.cwd(),
      "example/src/DemoHierarchy.tsx",
    );
    const appPath = path.join(process.cwd(), "example/src/App.tsx");
    const dataPath = path.join(process.cwd(), "example/src/data.ts");

    const demoHierarchySource = fs.readFileSync(demoHierarchyPath, "utf8");
    const appSource = fs.readFileSync(appPath, "utf8");
    const dataSource = fs.readFileSync(dataPath, "utf8");

    expect(demoHierarchySource).toContain("Show location level");
    expect(demoHierarchySource).toContain("Reset Demo");
    expect(demoHierarchySource).toContain('headerLabel="Fields"');

    expect(appSource).toContain("include or exclude the location level");

    expect(dataSource).toContain("createHierarchyDemoData");
    expect(dataSource).toContain("Location North Farm");
    expect(dataSource).toContain("Field A");
    expect(dataSource).toContain("Bed A1");

    expect(dataSource).not.toContain("Standort");
    expect(dataSource).not.toContain("Parzelle");
    expect(dataSource).not.toContain("Beet");
  });
});
