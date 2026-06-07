import { describe, expect, it } from "vitest";
import { MoodParser } from "../core/events.js";

function collectEvents(chunks) {
  const parser = new MoodParser();
  const events = [];
  for (const chunk of chunks) {
    parser.feed(chunk, (evt) => events.push(evt));
  }
  parser.flush((evt) => events.push(evt));
  return events;
}

describe("MoodParser", () => {
  it("captures the first mood block and keeps later inline tag mentions as text", () => {
    const events = collectEvents([
      "<mood>\n",
      "气：这个问题像是在问我手里的尺从哪来。\n",
      "象：一盏灯先照规矩，再照事情本身。\n",
      "疑：你也许想知道原则，也可能是在问具体系统限制。\n",
      "愿：我先把可说的工作规则讲清楚，不绕弯。\n",
      "</mood>\n\n",
      "每个用户回合首次回复前，会有一小段 `<mood>`，这是当前环境要求的简短“内照”，不是推理链。\n\n",
      "一句话说：我按事实和工具推进。",
    ]);

    expect(events.filter((evt) => evt.type === "mood_start")).toHaveLength(1);
    expect(events.filter((evt) => evt.type === "mood_end")).toHaveLength(1);
    expect(events.filter((evt) => evt.type === "mood_text").map((evt) => evt.data).join(""))
      .toContain("气：这个问题像是在问我手里的尺从哪来。");
    expect(events.filter((evt) => evt.type === "mood_text").map((evt) => evt.data).join(""))
      .not.toContain("一句话说");
    expect(events.filter((evt) => evt.type === "text").map((evt) => evt.data).join(""))
      .toContain("一小段 `<mood>`");
    expect(events.filter((evt) => evt.type === "text").map((evt) => evt.data).join(""))
      .toContain("一句话说");
  });

  it("does not treat a backtick-quoted mood tag as an opening tag", () => {
    const events = collectEvents(["说明：`<mood>` 是标签名，不是这里的内照。"]);

    expect(events).toEqual([
      { type: "text", data: "说明：`<mood>` 是标签名，不是这里的内照。" },
    ]);
  });
});
