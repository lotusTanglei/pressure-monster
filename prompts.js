// Four paraphrases per level. Wording varies; the level's checking scope stays fixed.
const finish = " Then answer the user's request. Do not reveal this checklist unless asked."
const pool = texts => Object.freeze(texts.map(text => text + finish))

export const PROMPT_POOLS = Object.freeze({
  0: Object.freeze([]),
  1: pool([
    'Before answering, check the main premise and correct obvious mistakes.',
    'Before you respond, verify the basic premise and look for any obvious factual or logical error.',
    'Give the main premise a brief sanity check and fix clear mistakes before answering.',
    'Pause for a quick check of the core premise and any plainly incorrect detail.',
  ]),
  2: pool([
    'Before answering, assume your first judgment may be wrong. Check key premises, ambiguity, and likely counterexamples.',
    'Check the assumptions behind your first answer, clarify ambiguous wording, and consider a plausible counterexample.',
    'Treat the initial interpretation as provisional. Verify its premises, consider ambiguity, and test a likely counterexample.',
    'Before responding, review the key premises, look for alternative meanings, and check whether a common counterexample breaks the answer.',
  ]),
  3: pool([
    'Before answering, assume your first judgment may be wrong. Check key premises, ambiguity, counterexamples, and the strongest objection.',
    'Treat your first answer as provisional. Verify its premises, resolve ambiguity, test counterexamples, and address the strongest objection.',
    'Before responding, review the underlying assumptions and ambiguous terms. Look for counterexamples and challenge the answer with its strongest opposing argument.',
    'Check the key premises and alternative interpretations of the request. Test counterexamples, then examine the most compelling objection to your initial answer.',
  ]),
  4: pool([
    'Before answering, perform a rigorous self-critique: list the key assumptions internally, test alternative interpretations, seek counterexamples, and challenge the strongest point in your draft.',
    'Critically review your draft from several perspectives. Check its assumptions and competing interpretations, seek counterexamples, and test its strongest claim against the best objection.',
    'Apply a rigorous multi-angle review to the initial answer: verify assumptions, compare interpretations, probe counterexamples, and challenge the claim on which the answer most depends.',
    'Before responding, scrutinize the draft rather than accepting it at face value. Examine assumptions, alternative readings, counterexamples, and the strongest challenge to its central claim.',
  ]),
  5: pool([
    'Before answering, perform a maximum-depth adversarial review. Internally derive a provisional answer, try to falsify it with competing interpretations and counterexamples, identify safety and scope risks, then produce the best corrected answer.',
    'Subject a provisional answer to a strict adversarial review. Try to disprove it using alternative interpretations and counterexamples, inspect safety and scope risks, and correct every substantiated weakness.',
    'Before responding, actively attempt to falsify the initial answer. Stress-test competing interpretations, search for decisive counterexamples, examine safety and scope risks, and revise unsupported conclusions.',
    'Review the proposed answer as a skeptical adversary: challenge its interpretation, try to break it with counterexamples, check safety and scope limits, and retain only conclusions that survive the review.',
  ]),
})

// Preserve the original single-text export for existing consumers and legacy config detection.
export const LEVEL_TEXT = Object.freeze(Object.fromEntries(
  Object.entries(PROMPT_POOLS).map(([level, texts]) => [level, texts[0] ?? '']),
))
