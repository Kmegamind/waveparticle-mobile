import { describe, expect, it } from "vitest";
import { PAUSE_CATEGORIES, pickPauseSnag } from "@/lib/content/pause-snag";
import { seedContent } from "./support/seed-content";

// #56 AC2 (US-AI-3, PAUSE-TWO-CALLS, AI_03 section A1): the code, not the model, picks the snag
// category and the prop of each Pause. There is no weather category (SCENE-PER-STORY).

const scene = {
  present: [],
  allowedWords: [],
  props: ["desk", "lamp", "notebook", "pencil"],
  pauseProp: "notebook",
  laterWords: [],
};

describe("#56 AC2 the code picks the category and the prop", () => {
  it("test_56_ac2_the_categories_are_body_gear_ground_paper_and_sound", () => {
    expect([...PAUSE_CATEGORIES]).toEqual(["body", "gear", "ground", "paper", "sound"]);
    expect(PAUSE_CATEGORIES).not.toContain("weather");
  });

  it("test_56_ac2_the_category_is_not_one_of_the_last_two_pauses", () => {
    for (const recent of [
      [],
      ["body"],
      ["body", "gear"],
      ["sound", "paper"],
      ["ground", "body"],
      ["paper", "sound", "body"],
    ]) {
      const { category } = pickPauseSnag({ scene, recentCategories: recent, usedProps: [] });
      expect(PAUSE_CATEGORIES, recent.join()).toContain(category);
      expect(recent.slice(-2), recent.join()).not.toContain(category);
    }
  });

  it("test_56_ac2_a_run_of_pauses_never_repeats_a_category_within_three", () => {
    const used: string[] = [];
    for (let pause = 0; pause < 12; pause += 1) {
      used.push(pickPauseSnag({ scene, recentCategories: used, usedProps: [] }).category);
    }
    for (let index = 2; index < used.length; index += 1) {
      expect(new Set(used.slice(index - 2, index + 1)).size).toBe(3);
    }
    expect(new Set(used).size).toBe(5);
  });

  it("test_56_ac2_the_first_prop_is_the_pause_prop_and_no_prop_repeats_in_a_step", () => {
    const usedProps: string[] = [];
    for (let pause = 0; pause < scene.props.length; pause += 1) {
      const { prop } = pickPauseSnag({ scene, recentCategories: [], usedProps });
      if (pause === 0) expect(prop).toBe("notebook");
      expect(scene.props).toContain(prop);
      expect(usedProps).not.toContain(prop);
      usedProps.push(prop);
    }
  });

  it("test_56_ac2_when_every_prop_was_used_the_round_starts_again_not_on_the_last_one", () => {
    const usedProps = ["notebook", "desk", "lamp", "pencil"];
    const { prop } = pickPauseSnag({ scene, recentCategories: [], usedProps });
    expect(scene.props).toContain(prop);
    expect(prop).not.toBe("pencil");
  });

  it("test_56_ac2_unknown_categories_and_props_from_the_request_are_ignored", () => {
    const { category, prop } = pickPauseSnag({
      scene,
      recentCategories: ["weather", "<script>"],
      usedProps: ["telegram"],
    });
    expect(PAUSE_CATEGORIES).toContain(category);
    expect(prop).toBe("notebook");
  });

  it("test_56_ac2_every_story_gets_a_prop_from_its_own_scene_table", () => {
    for (const story of seedContent().stories) {
      const table = story.inputs.scene!;
      const { prop } = pickPauseSnag({ scene: table, recentCategories: [], usedProps: [] });
      expect(table.props, story.id).toContain(prop);
    }
  });

  it("test_56_ac2_a_scene_whose_pause_prop_is_not_in_its_props_still_offers_it_first", () => {
    const odd = { ...scene, pauseProp: "teacup" };
    expect(pickPauseSnag({ scene: odd, recentCategories: [], usedProps: [] }).prop).toBe("teacup");
  });
});
