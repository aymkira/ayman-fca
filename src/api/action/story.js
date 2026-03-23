// ============================================================
//  AYMAN-FCA v2.0 — Story API
//  © 2025 Ayman. All Rights Reserved.
//  مستوحى من: ws3-fca | مطوَّر بواسطة أيمن
//
//  api.story.create(text, font, background)
//  api.story.react(storyID, emoji)
//  api.story.msg(storyID, message)
// ============================================================
"use strict";

module.exports = function(defaultFuncs, api, ctx) {

  const FONTS = {
    headline: "1919119914775364",
    classic:  "516266749248495",
    fancy:    "1790435664339626",
    casual:   "516266749248495"
  };

  const BACKGROUNDS = {
    orange: "2163607613910521",
    blue:   "401372137331149",
    green:  "367314917184744",
    modern: "554617635055752",
    red:    "1234567890123456"
  };

  const ALLOWED_REACTIONS = ["❤️","👍","🤗","😆","😡","😢","😮"];

  function getStoryID(urlOrID) {
    try {
      const u     = new URL(urlOrID);
      const parts = u.pathname.split("/");
      const idx   = parts.indexOf("stories");
      if (idx !== -1 && parts.length > idx + 2) return parts[idx + 2];
    } catch (_) {}
    return urlOrID;
  }

  // ✅ إنشاء Story نصية
  async function create(message, fontName = "classic", backgroundName = "blue") {
    const fontId = FONTS[fontName.toLowerCase()]       || FONTS.classic;
    const bgId   = BACKGROUNDS[backgroundName.toLowerCase()] || BACKGROUNDS.blue;

    const variables = {
      input: {
        audiences: [{ stories: { self: { target_id: ctx.userID } } }],
        audiences_is_complete: true,
        logging: { composer_session_id: "ayman-story-" + Date.now() },
        navigation_data: { attribution_id_v2: "StoriesCreateRoot.react,comet.stories.create" },
        source: "WWW",
        message: { ranges: [], text: message },
        text_format_metadata: { inspirations_custom_font_id: fontId },
        text_format_preset_id: bgId,
        tracking: [null],
        actor_id: ctx.userID,
        client_mutation_id: "1"
      }
    };

    const form = {
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "StoriesCreateMutation",
      variables: JSON.stringify(variables),
      doc_id: "24226878183562473"
    };

    const res     = await defaultFuncs.post("https://www.facebook.com/api/graphql/", ctx.jar, form);
    const data    = res?.data || res;
    if (data?.errors) throw new Error(JSON.stringify(data.errors));
    const storyID = data?.data?.story_create?.viewer?.actor?.story_bucket?.nodes?.[0]?.first_story_to_show?.id;
    if (!storyID) throw new Error("AYMAN-FCA: لم يُعثر على storyID");
    return { success: true, storyID };
  }

  // ✅ رد أو تفاعل مع Story
  async function sendStoryReply(storyIdOrUrl, message, isReaction) {
    if (!storyIdOrUrl) throw new Error("AYMAN-FCA: storyID مطلوب");
    if (!message)      throw new Error("AYMAN-FCA: message مطلوب");

    const storyID   = getStoryID(storyIdOrUrl);
    const variables = {
      input: {
        attribution_id_v2: "StoriesCometSuspenseRoot.react,comet.stories.viewer,via_cold_start",
        message,
        story_id:          storyID,
        story_reply_type:  isReaction ? "LIGHT_WEIGHT" : "TEXT",
        actor_id:          ctx.userID,
        client_mutation_id: String(Math.floor(Math.random() * 10 + 1))
      }
    };

    if (isReaction) {
      if (!ALLOWED_REACTIONS.includes(message))
        throw new Error(`AYMAN-FCA: تفاعل غير صالح. استخدم: ${ALLOWED_REACTIONS.join(" ")}`);
      variables.input.lightweight_reaction_actions = { offsets: [0], reaction: message };
    }

    const form = {
      fb_api_caller_class: "RelayModern",
      fb_api_req_friendly_name: "useStoriesSendReplyMutation",
      variables: JSON.stringify(variables),
      doc_id: "9697491553691692"
    };

    const res  = await defaultFuncs.post("https://www.facebook.com/api/graphql/", ctx.jar, form);
    const data = res?.data || res;
    if (data?.errors) throw new Error(JSON.stringify(data.errors));
    return { success: true, result: data?.data?.direct_message_reply };
  }

  return {
    create,
    react: (storyIdOrUrl, reaction) => sendStoryReply(storyIdOrUrl, reaction, true),
    msg:   (storyIdOrUrl, message)  => sendStoryReply(storyIdOrUrl, message,  false)
  };
};
