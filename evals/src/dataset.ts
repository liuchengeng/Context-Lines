import {
  DeepAnalysisSchema,
  QuickAnalysisSchema,
  TranscriptContextSchema,
  type DeepAnalysis,
  type QuickAnalysis,
  type TranscriptContext,
} from "@contextlines/contracts";

export const EVAL_CATEGORIES = [
  "rejection",
  "sarcasm",
  "idiom",
  "implication",
  "dialect",
  "workplace",
  "dating",
  "pop_culture",
] as const;

export type EvalCategory = (typeof EVAL_CATEGORIES)[number];

interface DialogueSeed {
  category: EvalCategory;
  previous: string;
  current: string;
  next: string;
  naturalZh: string;
  literalZh: string;
  intent: string;
  tone: string;
  register: string;
  chunk: string;
  chunkMeaning: string;
  usage: string;
  implied: string;
}

const seeds: DialogueSeed[] = [
  {
    category: "rejection",
    previous: "Would you like to join us for dinner?",
    current: "I think I'll sit this one out.",
    next: "Maybe another time, then.",
    naturalZh: "这次我就不参加了。",
    literalZh: "我想这一次我会坐在一旁。",
    intent: "委婉拒绝这次邀请，同时避免否定以后参加的可能。",
    tone: "礼貌、克制。",
    register: "自然日常口语。",
    chunk: "sit this one out",
    chunkMeaning: "这次不参加",
    usage: "用于主动退出某一次活动或安排。",
    implied: "拒绝的是本次安排，不一定是对对方或活动的整体否定。",
  },
  {
    category: "rejection",
    previous: "Can you take on one more client this week?",
    current: "I don't think I can give it the attention it deserves.",
    next: "Understood. I'll ask someone else.",
    naturalZh: "我恐怕没法投入足够的精力把它做好。",
    literalZh: "我觉得我无法给予它应得的关注。",
    intent: "通过强调质量和精力限制来拒绝额外任务。",
    tone: "专业、委婉。",
    register: "职场中性表达。",
    chunk: "give it the attention it deserves",
    chunkMeaning: "给予某事应有的重视和精力",
    usage: "常用于说明当前无法认真承担某项任务。",
    implied: "拒绝来自资源不足，而不是认为任务不重要。",
  },
  {
    category: "rejection",
    previous: "Should I book us tickets for Saturday?",
    current: "Let's not get ahead of ourselves.",
    next: "Right, we can decide later.",
    naturalZh: "我们先别急着往下推进。",
    literalZh: "我们不要跑到自己前面去。",
    intent: "暂缓计划，拒绝现在就作出更进一步的承诺。",
    tone: "谨慎、降温。",
    register: "自然口语。",
    chunk: "get ahead of ourselves",
    chunkMeaning: "操之过急，过早推进",
    usage: "用于提醒不要在信息或关系尚未成熟时过早行动。",
    implied: "当前的进展还不足以支持下一步安排。",
  },
  {
    category: "sarcasm",
    previous: "The printer jammed for the fourth time today.",
    current: "Oh, because that's exactly what we needed.",
    next: "I'll call maintenance again.",
    naturalZh: "呵，这可真是我们现在最需要的。",
    literalZh: "哦，因为那恰好就是我们所需要的。",
    intent: "用反话表达对新麻烦的不满。",
    tone: "讽刺、无奈。",
    register: "非正式口语。",
    chunk: "exactly what we needed",
    chunkMeaning: "正是我们所需要的，常作反话",
    usage: "遇到额外麻烦时可用作讽刺，需依靠语气和场景识别。",
    implied: "实际意思是这件事非常不合时宜。",
  },
  {
    category: "sarcasm",
    previous: "He arrived after everyone had cleaned up.",
    current: "Perfect timing, as usual.",
    next: "He missed all the work again.",
    naturalZh: "时间掐得可真准，还是老样子。",
    literalZh: "和往常一样，完美的时机。",
    intent: "讽刺对方总是在需要帮忙之后才出现。",
    tone: "尖锐、挖苦。",
    register: "非正式口语。",
    chunk: "perfect timing",
    chunkMeaning: "时机完美，也可反讽来得很不是时候",
    usage: "正面或反讽都可，需结合上下文与语调。",
    implied: "所谓完美时机恰恰表示对方来晚了。",
  },
  {
    category: "sarcasm",
    previous: "The forecast says rain for the entire picnic.",
    current: "Well, this plan is aging beautifully.",
    next: "We should probably move it indoors.",
    naturalZh: "嗯，这个计划真是越来越妙了。",
    literalZh: "这个计划正在优美地老化。",
    intent: "用夸张反话指出计划随着新情况变得更糟。",
    tone: "幽默、讽刺。",
    register: "轻松口语。",
    chunk: "aging beautifully",
    chunkMeaning: "发展得越来越好，此处反讽",
    usage: "可评论先前判断后来显得荒谬或不合时宜。",
    implied: "天气变化证明原计划并不好。",
  },
  {
    category: "idiom",
    previous: "Are we still considering the old proposal?",
    current: "That ship has sailed.",
    next: "Then we'll focus on the new option.",
    naturalZh: "那个机会已经错过了。",
    literalZh: "那艘船已经开走了。",
    intent: "说明旧方案已不再可行，推动讨论转向。",
    tone: "明确、带终结感。",
    register: "常见口语习语。",
    chunk: "that ship has sailed",
    chunkMeaning: "时机已过，机会已经错过",
    usage: "用于无法再回到某个旧选择或机会的情况。",
    implied: "继续讨论旧方案没有实际意义。",
  },
  {
    category: "idiom",
    previous: "Why didn't she challenge the decision?",
    current: "She didn't want to rock the boat.",
    next: "So she kept her concerns to herself.",
    naturalZh: "她不想打破现状、惹出麻烦。",
    literalZh: "她不想摇晃那条船。",
    intent: "解释某人为了避免冲突而没有提出异议。",
    tone: "解释性、中性。",
    register: "常见口语习语。",
    chunk: "rock the boat",
    chunkMeaning: "打破稳定局面，制造冲突",
    usage: "用于本来相对稳定、但可能因质疑而产生冲突的环境。",
    implied: "沉默是出于风险考虑，不等于赞同。",
  },
  {
    category: "idiom",
    previous: "Can we solve every issue before launch?",
    current: "We have to pick our battles.",
    next: "Let's fix the payment bug first.",
    naturalZh: "我们得有所取舍，把精力用在关键问题上。",
    literalZh: "我们必须选择自己的战斗。",
    intent: "要求按优先级处理问题，而不是同时解决全部问题。",
    tone: "务实、果断。",
    register: "常见口语与职场表达。",
    chunk: "pick our battles",
    chunkMeaning: "选择值得投入精力的问题",
    usage: "用于资源有限时的优先级取舍。",
    implied: "有些问题会暂时被接受或推迟。",
  },
  {
    category: "implication",
    previous: "Do you think the presentation went well?",
    current: "The slides looked nice.",
    next: "That's not quite what I asked.",
    naturalZh: "幻灯片看起来挺漂亮的。",
    literalZh: "那些幻灯片看起来不错。",
    intent: "只肯定外观，回避对整体表现作正面评价。",
    tone: "含蓄、保留。",
    register: "中性口语。",
    chunk: "looked nice",
    chunkMeaning: "看起来不错",
    usage: "单独肯定次要方面时，可能暗示主要方面不理想。",
    implied: "整体演示可能并不成功，但说话者不愿直接批评。",
  },
  {
    category: "implication",
    previous: "Will you be at the early meeting?",
    current: "Six in the morning is certainly a time.",
    next: "I'll take that as a no.",
    naturalZh: "早上六点，确实也算个时间。",
    literalZh: "早上六点当然是一个时间。",
    intent: "回避直接拒绝，同时表达对时间过早的不满。",
    tone: "干巴巴的幽默、保留。",
    register: "非正式口语。",
    chunk: "is certainly a time",
    chunkMeaning: "确实算个时间，暗示安排不理想",
    usage: "以陈述显而易见的事实来含蓄表达负面评价。",
    implied: "说话者很可能不愿参加这么早的会议。",
  },
  {
    category: "implication",
    previous: "Did you enjoy meeting my roommates?",
    current: "They have a lot of energy.",
    next: "You can just say they were loud.",
    naturalZh: "他们精力可真充沛。",
    literalZh: "他们有很多能量。",
    intent: "用较正面的措辞含蓄评价对方吵闹或强势。",
    tone: "外交式、委婉。",
    register: "日常口语。",
    chunk: "have a lot of energy",
    chunkMeaning: "精力充沛，也可能委婉表示过于活跃",
    usage: "评价人时可能是赞美，也可能是避免直接批评。",
    implied: "实际体验可能让说话者有些疲惫或不适。",
  },
  {
    category: "dialect",
    previous: "Are you staying for another drink?",
    current: "I'm fixing to head out.",
    next: "Drive safe, then.",
    naturalZh: "我正准备走了。",
    literalZh: "我正在准备出发。",
    intent: "告知对方自己即将离开。",
    tone: "随意、友好。",
    register: "带地区色彩的非正式美式口语。",
    chunk: "fixing to",
    chunkMeaning: "正准备、马上要",
    usage: "在部分美式英语地区口语中表示即将做某事。",
    implied: "离开的决定基本已经作出。",
  },
  {
    category: "dialect",
    previous: "You look upset. Is everything okay?",
    current: "I'm grand, just a bit wrecked.",
    next: "Get some rest when you get home.",
    naturalZh: "我没事，就是有点累坏了。",
    literalZh: "我很好，只是有点被弄坏了。",
    intent: "表示整体没问题，同时承认自己很疲惫。",
    tone: "随意、轻描淡写。",
    register: "带地区色彩的非正式口语。",
    chunk: "a bit wrecked",
    chunkMeaning: "有点筋疲力尽",
    usage: "非正式语境中可表示非常疲惫。",
    implied: "说话者不想把疲惫描述成严重问题。",
  },
  {
    category: "workplace",
    previous: "Can we promise the client a Friday delivery?",
    current: "I'd rather underpromise and overdeliver.",
    next: "Let's quote Monday and aim for Friday.",
    naturalZh: "我宁可承诺得保守一点，最后交付得更好。",
    literalZh: "我宁愿少承诺、多交付。",
    intent: "主张对外给出保守预期，降低失约风险。",
    tone: "审慎、专业。",
    register: "常见职场表达。",
    chunk: "underpromise and overdeliver",
    chunkMeaning: "少承诺、多交付",
    usage: "用于客户预期、进度或质量管理。",
    implied: "内部可以争取更早完成，但不应对外保证。",
  },
  {
    category: "workplace",
    previous: "Should we discuss the delay in the all-hands?",
    current: "Let's take that offline.",
    next: "I'll set up a smaller meeting.",
    naturalZh: "这件事我们会后单独谈。",
    literalZh: "我们把那件事拿到线下。",
    intent: "把当前公开讨论转移到更小范围或稍后处理。",
    tone: "简洁、管理式。",
    register: "职场口语。",
    chunk: "take that offline",
    chunkMeaning: "会后或另找场合讨论",
    usage: "用于避免当前会议偏题或控制讨论范围。",
    implied: "当前场合不适合继续展开，但话题不一定被拒绝。",
  },
  {
    category: "dating",
    previous: "Do you want to call this a relationship?",
    current: "I like where this is going, but I don't want to rush it.",
    next: "Okay, we can keep taking it one day at a time.",
    naturalZh: "我喜欢现在的发展，但不想进展得太快。",
    literalZh: "我喜欢这件事正在前往的方向，但我不想催促它。",
    intent: "表达积极兴趣，同时为关系升级设置节奏边界。",
    tone: "坦诚、谨慎。",
    register: "亲密关系中的自然口语。",
    chunk: "I like where this is going",
    chunkMeaning: "我喜欢目前的发展方向",
    usage: "用于肯定一段关系或合作的发展，同时仍保留空间。",
    implied: "不是拒绝关系，而是拒绝立刻定义或加速。",
  },
  {
    category: "dating",
    previous: "You haven't replied much this week.",
    current: "I've had a lot on my plate, but I should've said that sooner.",
    next: "Thanks for explaining. I was starting to worry.",
    naturalZh: "我这阵子事情很多，但我确实应该早点说明。",
    literalZh: "我的盘子里有很多东西，但我本该更早说。",
    intent: "解释联系减少的原因，同时承担沟通不及时的责任。",
    tone: "歉意、诚恳。",
    register: "自然口语。",
    chunk: "have a lot on my plate",
    chunkMeaning: "手头有很多事要处理",
    usage: "用于解释当前事务多、精力有限。",
    implied: "忙碌是真实原因，但说话者也承认这不能完全免除沟通责任。",
  },
  {
    category: "pop_culture",
    previous: "That ending felt like the Galaxy Knights finale.",
    current: "Please don't tell me they pulled another moon-key twist.",
    next: "No spoilers, but it was definitely dramatic.",
    naturalZh: "别告诉我他们又搞了一次“月之钥”式反转。",
    literalZh: "请别告诉我他们又拉出一个月之钥反转。",
    intent: "借一个流行文化式提及表达对套路重复的担忧。",
    tone: "玩笑、略带吐槽。",
    register: "依赖共同文化背景的非正式口语。",
    chunk: "pulled another twist",
    chunkMeaning: "又安排了一次剧情反转",
    usage: "评论故事套路时使用；具体指代取决于共同背景。",
    implied: "说话者担心作品重复先前的戏剧手法。",
  },
  {
    category: "pop_culture",
    previous: "Everyone keeps comparing the trailer to Silver City.",
    current: "I get the vibe, but let's not crown it a classic yet.",
    next: "Fair. We've only seen two minutes.",
    naturalZh: "我能感觉到那种风格，但先别急着封它为经典。",
    literalZh: "我理解那种氛围，但我们先不要给它加冕为经典。",
    intent: "承认相似感，同时反对在信息不足时过高评价。",
    tone: "克制、带幽默。",
    register: "流行文化讨论中的非正式口语。",
    chunk: "crown it a classic",
    chunkMeaning: "把它奉为经典",
    usage: "用于提醒不要过早给予极高评价。",
    implied: "预告片带来了好印象，但不足以证明成品质量。",
  },
];

const variants = [
  {
    title: "Synthetic dialogue A",
    prefix: "Earlier, the group changed plans.",
  },
  { title: "Synthetic dialogue B", prefix: "The conversation had been calm." },
  {
    title: "Synthetic dialogue C",
    prefix: "They had only a few minutes left.",
  },
  {
    title: "Synthetic dialogue D",
    prefix: "A related question came up first.",
  },
  { title: "Synthetic dialogue E", prefix: "No outside facts were provided." },
];

const languageFact = (text: string, confidence = 0.94) => ({
  text,
  classification: "language_fact" as const,
  confidence,
});

const sceneInference = (text: string, confidence = 0.78) => ({
  text,
  classification: "scene_inference" as const,
  confidence,
});

function contextFor(seed: DialogueSeed, index: number): TranscriptContext {
  const variant = variants[index]!;
  return TranscriptContextSchema.parse({
    previous: [
      { id: `lead-${index}`, sequence: 0, text: variant.prefix },
      { id: `previous-${index}`, sequence: 1, text: seed.previous },
    ],
    current: { id: `current-${index}`, sequence: 2, text: seed.current },
    next: { id: `next-${index}`, sequence: 3, text: seed.next },
    page: {
      title: variant.title,
      origin: "https://synthetic.example.test",
    },
  });
}

function quickFor(seed: DialogueSeed): QuickAnalysis {
  return QuickAnalysisSchema.parse({
    transcript: seed.current,
    natural_zh: languageFact(seed.naturalZh),
    literal_zh: languageFact(seed.literalZh),
    intent: sceneInference(seed.intent),
    tone: sceneInference(seed.tone),
    register: languageFact(seed.register, 0.88),
    chunks: [
      {
        text: seed.chunk,
        meaning_zh: languageFact(seed.chunkMeaning),
        usage_note: languageFact(seed.usage, 0.9),
      },
    ],
    confidence: 0.9,
    scene_inference: [
      {
        ...sceneInference(seed.implied, 0.8),
        classification: "scene_inference",
      },
    ],
    insufficient_context: false,
  });
}

function deepFor(seed: DialogueSeed): DeepAnalysis {
  return DeepAnalysisSchema.parse({
    transcript: seed.current,
    implied_meaning: sceneInference(seed.implied, 0.82),
    pragmatic_function: languageFact(
      "用措辞、语气和上下文完成直接字面之外的交际功能。",
      0.9,
    ),
    usage_notes: [languageFact(seed.usage, 0.9)],
    example_variants: [
      {
        english: `A synthetic example using “${seed.chunk}”.`,
        natural_zh: "一个使用该表达块的合成例句。",
        context: languageFact("仅用于结构测试，实际例句需结合自然场景。", 0.95),
      },
    ],
    inappropriate_contexts: [
      sceneInference("需要正式、无歧义结论时，不应只依赖含蓄表达。", 0.8),
    ],
    cultural_context:
      seed.category === "pop_culture"
        ? [
            {
              text: "提及的作品和剧情细节属于外部事实，未联网核实；这里只分析语言功能。",
              classification: "external_fact",
              confidence: 0.35,
            },
          ]
        : [],
    confidence: 0.88,
    insufficient_context: false,
  });
}

export interface EvalCase {
  id: string;
  category: EvalCategory;
  synthetic: true;
  context: TranscriptContext;
  referenceQuick: QuickAnalysis;
  referenceDeep: DeepAnalysis;
  humanReviewStatus: "pending";
}

export const evalDataset: EvalCase[] = seeds.flatMap((seed, seedIndex) =>
  variants.map((_, variantIndex) => ({
    id: `${seed.category}-${String(seedIndex + 1).padStart(2, "0")}-${variantIndex + 1}`,
    category: seed.category,
    synthetic: true,
    context: contextFor(seed, variantIndex),
    referenceQuick: quickFor(seed),
    referenceDeep: deepFor(seed),
    humanReviewStatus: "pending",
  })),
);
