import { beforeEach, describe, expect, it, vi } from "vitest";

const { createForgeMcpServerMock, serveStdioMock } = vi.hoisted(() => ({
  createForgeMcpServerMock: vi.fn(),
  serveStdioMock: vi.fn(),
}));

vi.mock("@modelcontextprotocol/server/stdio", () => ({
  serveStdio: serveStdioMock,
}));

vi.mock("./create-forge-mcp-server.js", () => ({
  createForgeMcpServer: createForgeMcpServerMock,
}));

import { serveForgeMcpStdio } from "./stdio.js";

describe("serveForgeMcpStdio", () => {
  beforeEach(() => {
    createForgeMcpServerMock.mockReset();
    serveStdioMock.mockReset();
  });

  it("delegates transport ownership to the official SDK", async () => {
    const handle = { marker: "stdio-handle" };
    const server = { marker: "mcp-server" };
    const options = {
      name: "stdio-test",
      version: "0.2.0",
      createApplication: vi.fn(),
    };

    serveStdioMock.mockReturnValue(handle);
    createForgeMcpServerMock.mockResolvedValue(server);

    const result = serveForgeMcpStdio(options);

    expect(result).toBe(handle);
    expect(serveStdioMock).toHaveBeenCalledOnce();

    const factory = serveStdioMock.mock.calls[0]?.[0];

    expect(factory).toBeTypeOf("function");
    expect(await factory()).toBe(server);
    expect(createForgeMcpServerMock).toHaveBeenCalledWith(options);
  });
});
