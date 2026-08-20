
import { vi } from "vitest";

export function createMockD1() {
  const statement = {
    bind: vi.fn().mockReturnThis(),
    first: vi.fn(),
    all: vi.fn(),
    run: vi.fn(),
  };

  return {
    prepare: vi.fn().mockReturnValue(statement),
    statement
  };
}
