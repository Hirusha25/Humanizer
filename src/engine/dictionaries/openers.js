// Sentence-initial connectors. Matched at the very start of a sentence.
// Alternatives include their own trailing space/comma; '' deletes the opener.
export const OPENERS = [
  [/^(?:However|Nevertheless|Nonetheless|That being said|Having said that|With that said|That said|Be that as it may),?\s+/i,
    ['But ', 'Still, ', 'That said, ', 'Then again, ', 'Even so, ', 'Though, ']],
  [/^(?:Furthermore|Moreover|Additionally|In addition|In addition to (?:this|that)|What is more|What's more|Also|Besides(?: this| that)?),?\s+/i,
    ['Also, ', 'Plus, ', 'On top of that, ', 'And ', '', '']],
  [/^(?:Therefore|Thus|Hence|Consequently|As a result|As such|Accordingly|For this reason|Because of this|For these reasons),?\s+/i,
    ['So ', 'So, ', 'Because of that, ', "That's why ", 'Which means ', 'This is why ']],
  [/^(?:In conclusion|To conclude|In summary|To summarize|To summarise|To sum up|In closing|All things considered|Taking everything into account|In the final analysis),?\s+/i,
    ['All in all, ', 'So, ', 'In the end, ', 'Long story short, ', 'In short, ', 'To wrap up, ', '']],
  [/^(?:Ultimately|Overall|In essence|Essentially|Fundamentally|At its core|Basically),?\s+/i,
    ['In the end, ', 'At the end of the day, ', 'Basically, ', 'Really, ', 'When it comes down to it, ', '']],
  [/^(?:It is (?:important|essential|crucial|vital|worth noting|worth mentioning|worth noting) to (?:note|mention|remember|understand|recognize|recognise) that|It should be noted that|It is worth noting that|It's worth noting that|It is worth mentioning that|It's worth mentioning that|Notably|Importantly|Interestingly|Crucially|Significantly),?\s+/i,
    ['', '', 'Keep in mind that ', 'Remember, ', 'One thing: ', 'Note that ']],
  [/^(?:First and foremost|First of all|Firstly|To begin with|To start with),?\s+/i,
    ['First, ', 'To start, ', 'First off, ', 'For starters, ']],
  [/^(?:Secondly),?\s+/i, ['Second, ', 'Next, ', 'Then, ']],
  [/^(?:Thirdly),?\s+/i, ['Third, ', 'Then, ', 'After that, ']],
  [/^(?:Lastly|Finally|Last but not least|Last of all),?\s+/i, ['Finally, ', 'Last, ', 'And finally, ', 'Lastly, ', 'One more thing: ']],
  [/^In today'?s [\w\s-]{3,40}?(?:world|age|era|society|landscape|environment|economy|market|climate),?\s+/i,
    ['These days, ', 'Nowadays, ', 'Today, ', 'Right now, ']],
  [/^(?:For instance|As an example|To illustrate|By way of example),?\s+/i, ['For example, ', 'For example, ', 'Take this: ', 'Say ']],
  [/^(?:On the other hand|Conversely|In contrast|By contrast|On the contrary),?\s+/i,
    ['Then again, ', 'But ', 'On the flip side, ', 'Meanwhile, ', 'At the same time, ']],
  [/^(?:In other words|That is to say|Put simply|Simply put|To put it simply|To put it another way),?\s+/i,
    ['Basically, ', 'In plain terms, ', 'Put another way, ', 'Meaning, ', 'So, ']],
  [/^(?:Undoubtedly|Without a doubt|Certainly|Indeed|Clearly|Obviously|Of course|Needless to say|Unquestionably|Admittedly),?\s+/i,
    ['', 'Sure, ', 'No doubt, ', 'Clearly, ', 'Honestly, ']],
  [/^(?:In the (?:realm|world|field|context|domain|sphere) of)\s+/i, ['In ', 'When it comes to ', 'Around ', 'With ']],
  [/^(?:Whether you(?:'re| are) a [^,]{3,40} or [^,]{3,40}),\s+/i, ['', 'No matter your level, ', 'Either way, ', 'Whoever you are, ']],
  [/^(?:Let's (?:delve|dive) (?:into|in to|deeper into))\s+/i, ["Let's get into ", "Let's dig into ", "Let's look at ", "Let's talk about "]],
  [/^(?:Generally speaking|In general|As a general rule|Typically|Usually),?\s+/i, ['Usually, ', 'Most of the time, ', 'As a rule, ', 'Generally, ']],
  [/^(?:In particular|Specifically|More specifically),?\s+/i, ['In particular, ', 'Specifically, ', 'To be exact, ', 'Namely, ']],
  [/^(?:Similarly|Likewise|In the same vein|By the same token|Along the same lines),?\s+/i, ['In the same way, ', 'Likewise, ', 'Same goes for this: ', 'And ']],
  [/^(?:Subsequently|Afterwards|Thereafter),?\s+/i, ['After that, ', 'Then, ', 'Later, ', 'Next, ']],
  [/^(?:Regardless|Irrespective of this|Either way),?\s+/i, ['Either way, ', 'Whatever the case, ', 'Anyway, ', 'Regardless, ']],
  [/^(?:Meanwhile|In the meantime),?\s+/i, ['Meanwhile, ', 'At the same time, ', 'While that happens, ']],
  [/^(?:Without further ado),?\s+/i, ['So, ', 'Right, ', '']],
];

/** Openers that detectors treat as formal-transition tells (used for scoring only). */
export const FORMAL_OPENER_RE =
  /^(?:However|Nevertheless|Nonetheless|Furthermore|Moreover|Additionally|In addition|Therefore|Thus|Hence|Consequently|As a result|As such|Accordingly|In conclusion|To conclude|In summary|To summarize|To sum up|Ultimately|Overall|In essence|Essentially|It is important to note|It is worth noting|It's worth noting|Notably|Importantly|Firstly|Secondly|Thirdly|Lastly|Conversely|In contrast|In other words|Undoubtedly|Certainly|Indeed|Subsequently|Similarly|Likewise|In today's)\b/i;
