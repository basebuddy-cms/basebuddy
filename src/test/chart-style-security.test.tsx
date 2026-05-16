import React from "react";
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { ChartStyle } from "@/components/ui/chart";

describe("ChartStyle", () => {
  it("serializes only safe chart style identifiers and colors", () => {
    const { container } = render(
      <div>
        <ChartStyle
          id={'chart"]{} body{background:red}/*'}
          config={{
            "safe-key": { color: "hsl(var(--chart-1))" },
            "bad;key": { color: "#123456" },
            danger: { color: "red; background: url(javascript:alert(1))" },
          }}
        />
      </div>,
    );

    const style = container.querySelector("style");
    expect(style).not.toBeNull();
    expect(style.textContent).toContain("--color-safe-key: hsl(var(--chart-1));");
    expect(style.textContent).not.toContain("bad;key");
    expect(style.textContent).not.toContain("javascript:");
    expect(style.textContent).not.toContain("body{background:red}");
  });
});
