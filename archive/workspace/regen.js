const fs = require('fs');

function buildSeoPage(opts) {
  const faqJson = JSON.stringify(opts.faqItems.map(f => ({
    "@type": "Question",
    "name": f.q,
    "acceptedAnswer": { "@type": "Answer", "text": f.a }
  })));
  
  // Pre-build FAQ items HTML
  const faqItemsHtml = opts.faqItems.map(f => 
    '<div class="faq-item"><div class="faq-q">'+f.q.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div><div class="faq-a">'+f.a.replace(/</g,'&lt;').replace(/>/g,'&gt;')+'</div></div>'
  ).join('\n    ');

  // Pre-fill script if prefill is provided
  const prefillScript = opts.prefill 
    ? '<script>window.addEventListener("DOMContentLoaded",function(){var t=document.getElementById("seoMsgInput");if(t){t.value='+JSON.stringify(opts.prefill)+';}});</script>' 
    : '';

  return '<\!DOCTYPE html>\n' +
    '<html lang="en">\n' +
    '<head>\n' +
    '<meta charset="UTF-8">\n' +
    '<meta name="viewport" content="width=device-width,initial-scale=1.0">\n' +
    '<title>'+escHtml(opts.pageTitle)+'</title>\n' +
    '<meta name="description" content="'+escHtml(opts.metaDesc)+'">\n' +
    '<link rel="canonical" href="https://shouldiholdoff.live'+opts.slug+'">\n' +
    '<meta property="og:title" content="'+escHtml(opts.ogTitle)+'">\n' +
    '<meta property="og:description" content="'+escHtml(opts.ogDesc)+'">\n' +
    '<meta property="og:url" content="https://shouldiholdoff.live'+opts.slug+'">\n' +
    '<meta property="og:type" content="article">\n' +
    '<meta property="og:site_name" content="HoldOff">\n' +
    '<meta property="og:image" content="https://shouldiholdoff.live/icons/icon-512.png">\n' +
    '<meta name="twitter:card" content="summary">\n' +
    '<meta name="twitter:title" content="'+escHtml(opts.ogTitle)+'">\n' +
    '<meta name="twitter:description" content="'+escHtml(opts.ogDesc)+'">\n' +
    '<meta name="twitter:image" content="https://shouldiholdoff.live/icons/icon-512.png">\n' +
    '<link rel="manifest" href="/manifest.webmanifest">\n' +
    '<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">\n' +
    '<link rel="icon" type="image/png" sizes="192x192" href="/icons/icon-192.png">\n' +
    '<meta name="theme-color" content="#FAF6F0">\n' +
    '<link rel="preconnect" href="https://fonts.googleapis.com">\n' +
    '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n' +
    '<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,400;0,9..144,600;0,9..144,700;1,9..144,400&family=DM+Sans:wght@300;400;500;600&display=swap" rel="stylesheet">\n' +
    '<link rel="stylesheet" href="/css/theme.css">\n' +
    '<script>\!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(\!f._fbq)f._fbq=n;n.push=n;n.loaded=\!0;n.version="2.0";n.queue=[];t=b.createElement(e);t.async=\!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,"script","https://connect.facebook.net/en_US/fbevents.js");fbq("init","878230961304067");fbq("track","PageView");</script>\n' +
    '<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=878230961304067&ev=PageView&noscript=1"/></noscript>\n' +
    '<script type="application/ld+json">{"@context":"https://schema.org","@type":"FAQPage","mainEntity":'+faqJson+'}</script>\n' +
    '<style>\n' +
    'body{background:#FAF6F0;color:#2A2522;font-family:"DM Sans",system-ui,sans-serif;margin:0}\n' +
    '.nav{padding:1.25rem 2rem;border-bottom:1px solid #E5DED4;background:#fff}\n' +
    '.nav a{font-family:"Fraunces",Georgia,serif;font-size:1.3rem;font-weight:700;color:#2A2522;text-decoration:none}\n' +
    '.page{max-width:720px;margin:0 auto;padding:5rem 1.5rem 4rem}\n' +
    '.h1{font-family:"Fraunces",Georgia,serif;font-size:clamp(2rem,5vw,3rem);font-weight:700;letter-spacing:-0.03em;line-height:1.1;margin:0 0 1.25rem;color:#2A2522}\n' +
    '.lede{font-size:1.1rem;color:#8A7F79;margin:0 0 2rem;line-height:1.6}\n' +
    '.body h2{font-family:"Fraunces",Georgia,serif;font-size:1.4rem;font-weight:600;margin:2rem 0 0.6rem;color:#2A2522}\n' +
    '.body p{font-size:0.97rem;color:#4A3F3A;line-height:1.75;margin:0 0 1rem}\n' +
    '.body ul{padding-left:1.25rem;margin:0 0 1rem}\n' +
    '.body li{font-size:0.97rem;color:#4A3F3A;line-height:1.7;margin:0 0 0.35rem}\n' +
    '.body ol{padding-left:1.25rem;margin:0 0 1rem}\n' +
    '.body ol li{font-size:0.97rem;color:#4A3F3A;line-height:1.7;margin:0 0 0.35rem}\n' +
    '.cta{background:#2A2522;border-radius:12px;padding:1.75rem;text-align:center;margin:2.5rem 0}\n' +
    '.cta p{color:#FAF6F0;font-size:1rem;margin:0 0 1rem}\n' +
    '.cta a{display:inline-block;background:#C97B5D;color:#fff;font-weight:600;font-size:0.95rem;padding:0.75rem 1.75rem;border-radius:8px;text-decoration:none}\n' +
    '.cta a:hover{background:#b56a4c}\n' +
    '.faq{margin-top:3rem}\n' +
    '.faq h2{font-family:"Fraunces",Georgia,serif;font-size:1.4rem;font-weight:600;margin:0 0 1.25rem;color:#2A2522}\n' +
    '.faq-item{margin-bottom:1.5rem}\n' +
    '.faq-q{font-weight:600;color:#2A2522;margin:0 0 0.35rem;font-size:0.97rem}\n' +
    '.faq-a{font-size:0.92rem;color:#5A4F4A;line-height:1.7}\n' +
    '.crumb{font-size:0.8rem;color:#8A7F79;margin-bottom:1rem}\n' +
    '.crumb a{color:#8A7F79;text-decoration:none}\n' +
    '.crumb a:hover{color:#C97B5D}\n' +
    '.footer{text-align:center;padding:2rem;color:#8A7F79;font-size:0.85rem}\n' +
    '.footer a{color:#C97B5D}\n' +
    '</style>\n' +
    '</head>\n' +
    '<body>\n' +
    '<nav class="nav"><a href="/">HoldOff</a></nav>\n' +
    '<main class="page">\n' +
    '<div class="crumb"><a href="/">HoldOff</a> \u203a <a href="/spirals">Spirals</a> \u203a <span>'+escHtml(opts.h1)+'</span></div>\n' +
    '<h1 class="h1">'+escHtml(opts.h1)+'</h1>\n' +
    '<p class="lede">'+escHtml(opts.lede)+'</p>\n' +
    prefillScript +
    '<div id="w" style="background:#F2EDE5;border:1px solid #E5DED4;border-radius:12px;padding:2rem;margin:2rem 0;max-width:640px">\n' +
    '<h2 style="font-family:Fraunces,Georgia,serif;font-size:1.4rem;font-weight:600;margin:0 0 0.4rem;color:#2A2522">Try it right now</h2>\n' +
    '<p style="font-size:0.9rem;color:#8A7F79;margin:0 0 1.25rem">Paste the message you are about to send. Get an honest verdict in seconds.</p>\n' +
    '<form id="f"><textarea id="m" style="width:100%;background:#fff;border:1px solid #E5DED4;border-radius:8px;padding:0.875rem;font-family:DM Sans,system-ui,sans-serif;font-size:0.95rem;color:#2A2522;resize:vertical;outline:none;display:block;margin-bottom:0.875rem" rows="4" maxlength="2000" required placeholder="Type or paste the message here..."></textarea><button type="submit" style="background:#C97B5D;color:#fff;border:none;border-radius:8px;padding:0.75rem 1.5rem;font-family:DM Sans,system-ui,sans-serif;font-size:0.95rem;font-weight:600;cursor:pointer;width:100%">Get my verdict</button></form>\n' +
    '<div id="r" style="display:none">\n' +
    '<div id="v" style="font-family:Fraunces,Georgia,serif;font-size:2.2rem;font-weight:700;letter-spacing:-0.02em;margin:0 0 0.5rem;color:#C97B5D"></div>\n' +
    '<div id="p" style="font-size:1rem;font-weight:600;color:#2A2522;margin:0 0 0.75rem"></div>\n' +
    '<div id="e" style="font-size:0.9rem;color:#5A4F4A;line-height:1.6;margin:0 0 1rem"></div>\n' +
    '<div id="w2" style="display:none;background:#fff;border:1px solid #E5DED4;border-radius:8px;padding:1rem;margin:0 0 1rem"><div style="font-size:0.75rem;color:#8A7F79;text-transform:uppercase;letter-spacing:0.06em;margin:0 0 0.4rem">If you must send something</div><div id="r2" style="font-size:0.9rem;color:#2A2522;line-height:1.6;font-style:italic"></div></div>\n' +
    '<div style="display:flex;gap:1rem;align-items:center;flex-wrap:wrap"><button id="t" style="background:none;border:1px solid #E5DED4;border-radius:6px;padding:0.5rem 1rem;font-family:DM Sans,system-ui,sans-serif;font-size:0.85rem;color:#8A7F79;cursor:pointer"> Try another</button><a href="/filter" style="font-size:0.85rem;font-weight:600;color:#C97B5D;text-decoration:none">Open full app \u2192</a></div>\n' +
    '</div>\n' +
    '<div id="x" style="display:none"><p style="color:#e05;font-size:0.9rem;margin:0 0 0.75rem">Something went wrong. Try again.</p><button id="z" style="background:none;border:1px solid #E5DED4;border-radius:6px;padding:0.5rem 1rem;font-family:DM Sans,system-ui,sans-serif;font-size:0.85rem;color:#8A7F79;cursor:pointer">Try again</button></div>\n' +
    '</div>\n' +
    '<script>document.getElementById("f").addEventListener("submit",function(e){e.preventDefault();var m=document.getElementById("m").value.trim();if(\!m)return;var b=e.target.querySelector("button");b.disabled=true;b.textContent="Thinking...";fetch("/api/filter/analyze",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({message:m})}).then(function(r){return r.json()}).then(function(d){if(d.error||\!d.verdict)throw new Error(d.error||"No verdict");document.getElementById("v").textContent=d.verdict;document.getElementById("p").textContent=d.pattern||"";document.getElementById("e").textContent=d.reframe||"";var w2=document.getElementById("w2");var r2=document.getElementById("r2");if(d.rewrite){r2.textContent=d.rewrite;w2.style.display="block"}else{w2.style.display="none"}document.getElementById("w").querySelector("#f").style.display="none";document.getElementById("r").style.display="block"}).catch(function(){document.getElementById("w").querySelector("#x").style.display="block"}).finally(function(){b.disabled=false;b.textContent="Get my verdict"})});document.getElementById("t").onclick=function(){document.getElementById("m").value="";document.getElementById("w").querySelector("#f").style.display="block";document.getElementById("r").style.display="none";document.getElementById("x").style.display="none"};document.getElementById("z").onclick=function(){document.getElementById("w").querySelector("#f").style.display="block";document.getElementById("x").style.display="none"};</script>\n' +
    '<div class="body">\n' + opts.bodyContent + '\n' +
    '</div>\n' +
    '<div class="cta"><p>The full app tracks your streak, rewrites the ones that should not go out, and tells you what is really happening.</p><a href="/filter">Open HoldOff free \u2192</a></div>\n' +
    '<div class="faq"><h2>Common questions</h2>\n    '+faqItemsHtml+'\n' +
    '</div>\n' +
    '</main>\n' +
    '<footer class="footer">&copy; HoldOff &mdash; <a href="/filter">Open the app</a></footer>\n' +
    '</body>\n' +
    '</html>';
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

const newPages = {
  'why-do-i-keep-double-texting': {
    slug:'/why-do-i-keep-double-texting', pageTitle:"Why Do I Keep Double Texting \u2014 HoldOff",
    metaDesc:"The real reason you send a second text before getting a reply. Pattern-name page tied to protest behavior \u2014 plus a verdict widget so you stop before you send again.",
    ogTitle:"Why Do I Keep Double Texting", ogDesc:"The real reason you send a second text before getting a reply. Pattern-name page tied to protest behavior.",
    h1:"Why Do I Keep Double Texting", lede:"You sent one message. No reply. So you sent another. Here is the honest version of what is actually happening.",
    bodyContent:"<p>You sent one message. No reply. So you sent another.</p><p>Maybe it was casual. Maybe it started \"haha\" and ended up being a full paragraph. Either way \u2014 you know you did it. And you are wondering what is wrong with you, or what is wrong with them, or what any of this means.</p><p>Here is the honest version.</p><h2>Double texting is a protest behavior</h2><p>Anxious attachment does not just want connection \u2014 it wants proof of connection. When that proof does not come immediately, your nervous system interprets silence as abandonment risk. So you escalate.</p><p>The second text is not random. It says: <em>I need to know you are still here. I am going to make a move until you confirm it.</em></p><p>That is not a character flaw. That is activation. But it is also not working for you.</p><h2>When double texting is fine</h2><p>If you and this person have an established rhythm where back-and-forth happens naturally \u2014 and a second message just continues the thread \u2014 that is normal texting. Nobody is tracking response times in a good relationship. Skip to the last section.</p><h2>When it is a problem</h2><p>Double texting becomes a problem when it changes the dynamic. When you notice yourself:</p><ul><li>Adding a third text after the second gets no reply</li><li>Rereading his last message to justify sending another</li><li>Writing texts you delete and rewrite three times before sending</li><li>Making the reply about managing your anxiety instead of the actual conversation</li></ul><p>This is the spiral. And the more you do it, the more it rewires your brain to treat silence as a threat. That is the part worth stopping.</p><h2>What you are actually trying to do</h2><p>Most double texts have the same underlying request underneath different words: <em>please confirm I matter to you.</em></p><p>The problem is that texting for that confirmation rarely gets you what you want. It gets you:</p><ul><li>A late reply that is polite, not warm</li><li>An \"lol yeah sorry was busy\" that you then analyze for 45 minutes</li><li>A response hours later that says nothing and somehow makes you feel worse</li></ul><p>You are reaching for something in the text that only a conversation can give you.</p><h2>The actual move</h2><p>Screenshot the text you were about to send. Paste it into HoldOff\u2019s verdict widget above \u2014 and see what it says before you send.</p><p>The double-text is not inevitable. You just need to see it clearly before it goes out.</p>",
    faqItems:[
      {q:"Why do I keep double texting even when I know I should not?",a:"Because anxious attachment treats silence as a threat signal, and your nervous system escalates to manage that threat. Double texting is a protest behavior \u2014 a way of saying \u2018I need proof you are still here.\u2019 Knowing you should not does not stop it because it is not a logic problem, it is an activation problem."},
      {q:"Is double texting always a bad sign?",a:"No. If it is a genuine continuation of a thread \u2014 you had something else to add, or something changed \u2014 it is normal. The bad sign is when you are double texting to manage your anxiety, not to communicate something real."},
      {q:"How do I stop double texting without losing him?",a:"The goal is not to stop texting \u2014 it is to text from a grounded place. If you double text because you genuinely had something to say, that is fine. If you double text because silence feels like rejection, that is what you need to interrupt. The app helps you see the difference before you send."},
      {q:"What does it mean if he does not double text back?",a:"It can mean many things: he is busy, he is unsure what to say, he is not a big texter, or he is losing interest. One instance does not tell you which. Look at the pattern over time, not one unanswered message."}
    ],
    prefill:"ok so are we just not talking anymore or what? because i'm getting mixed signals here and it's really not cool to leave me hanging like this"
  },
  'anxious-attachment-texting-rules': {
    slug:'/anxious-attachment-texting-rules', pageTitle:"Anxious Attachment Texting Rules \u2014 HoldOff",
    metaDesc:"7 hard rules for anxious attachment texting \u2014 no platitudes, no just be confident. These are the actual moves that change how conversations go.",
    ogTitle:"Anxious Attachment Texting Rules", ogDesc:"7 hard rules for anxious attachment texting \u2014 no platitudes, no just be confident. These are the actual moves that change how conversations go.",
    h1:"Anxious Attachment Texting Rules", lede:"You already know you are overthinking this. You just need to know what to do instead.",
    bodyContent:"<p>You already know you are overthinking this. You just need to know what to do instead.</p><p>These are the rules that actually change behavior \u2014 not be more secure but specific, applicable moves. Pick what resonates. Start there.</p><h2>1. Send the text, then wait.</h2><p>The biggest mistake is treating every message as the last chance to say the thing. It is not. You are allowed to follow up later \u2014 but not while you are in the anxiety. Send what you want to send, then put the phone down. The follow-up is always cleaner when you have had a few hours.</p><h2>2. One text per question.</h2><p>Do not send three messages in a row that could have been one. Each message is a decision. If you are mid-sentence and realize it has been 30 seconds since you hit send \u2014 stop typing. Wait for the reply. The extra context can wait.</p><h2>3. No texts while you are in your feelings.</h2><p>If you are crying, spiraling, or running through every possibility \u2014 you are not in a state to write anything you will be proud of later. Set the phone down. Come back in an hour. This rule applies especially at night.</p><h2>4. Ask for what you actually need \u2014 not what you think they can give.</h2><p>\"You never text me first\" puts them on trial. \"I need more consistency from you\" is a relationship conversation, not a text. The difference matters. If you want something specific, ask for it directly \u2014 and accept that they might not give it.</p><h2>5. Assume they saw it.</h2><p>Do not send \"?\" or \"hello??\" unless you actually have a reason to believe there is a technical problem. If someone saw your message and is not responding, a second text will not change their answer \u2014 it just changes how they feel about having to give it.</p><h2>6. If you have written it twice, rewrite it.</h2><p>This is the most reliable test. If you typed the same message once, deleted it, and wrote it again \u2014 the version that stays is usually the anxious one. The draft you gave up on is usually closer to what you actually want to say.</p><h2>7. The phone is not a mirror.</h2><p>You cannot use silence as a way to figure out how he feels. People do not always respond at the speed or with the warmth you need, and that does not mean what you think it means. It just means he is a person with his own schedule, his own bandwidth, and his own version of being present.</p>",
    faqItems:[
      {q:"What are the texting rules for anxious attachment?",a:"The key rules: send one text per question, never text while in your feelings (especially at night), assume they saw it unless you have technical evidence otherwise, and if you have rewritten a message twice, rewrite it again \u2014 the anxious version is not the right one."},
      {q:"How do I stop overthinking my texts?",a:"The most effective intervention is interruption \u2014 put time between the urge to send and the act of sending. 20 minutes is usually enough for the urgency to drop. Run the text through HoldOff to see what is actually in it before you send."},
      {q:"Is it okay to double text?",a:"Sometimes \u2014 if you have something genuinely new to say or you forgot something material. Not if you are double texting to manage anxiety, check if they are still interested, or restart a conversation that ended naturally."},
      {q:"How do I know if I am being too much?",a:"If the thought \"is this too much?\" is showing up, that is data. Check the pattern: are you texting because you have something to say, or because silence feels like proof something is wrong? The first is communication. The second is anxiety."}
    ],
    prefill:"hey just checking in to make sure everything is okay between us because you seemed kind of off last time we talked and i wanted to address it before it becomes a bigger issue"
  },
  'he-stopped-texting-back-am-i-being-ignored': {
    slug:'/he-stopped-texting-back-am-i-being-ignored', pageTitle:"He Stopped Texting Back \u2014 Am I Being Ignored? \u2014 HoldOff",
    metaDesc:"He stopped texting back. You are spiraling. This reframes what is actually happening \u2014 and tells you exactly what to do with the silence.",
    ogTitle:"He Stopped Texting Back \u2014 Am I Being Ignored?", ogDesc:"He stopped texting back. You are spiraling. This reframes what is actually happening \u2014 and tells you exactly what to do with the silence.",
    h1:"He Stopped Texting Back \u2014 Am I Being Ignored?", lede:"You sent something. It felt normal. And now it has been hours and nothing. Before you send anything, read this.",
    bodyContent:"<p>You sent something. It felt normal. And now it has been hours and nothing.</p><p>Your brain has already written four different scenarios. He is ignoring you. He is done. He met someone else. He is waiting for you to reach out again to prove you are interested. You are being paranoid \u2014 he is probably just busy.</p><p>Before you send anything, read this.</p><h2>You do not know why he stopped texting.</h2><p>That is the part that actually matters. Silence does not come with a label. And your attachment system \u2014 which is very good at filling gaps with worst-case scenarios \u2014 is not a reliable narrator here.</p><p>But let us talk about what silence usually actually means.</p><h2>Most of the time, it is capacity \u2014 not rejection.</h2><p>People go quiet for reasons that have nothing to do with you:</p><ul><li>They are overwhelmed at work and genuinely have not had a free hour</li><li>They are in a family situation they do not know how to explain over text</li><li>They saw your message, felt uncertain about how to respond, and kept putting it off</li><li>They are in a bad headspace and do not want to bring that into the conversation</li></ul><p>None of these feel like not being ignored when you are on the other end of it. But they are not the same thing.</p><h2>The difference between being ignored and being deprioritized</h2><p>There is a version of this that is real. Sometimes silence is not about bandwidth \u2014 it is about interest level. When someone consistently takes two days to reply, responds in one word, and never initiates \u2014 that is not a busy period. That is a low-investment person.</p><p>That matters. But it takes longer than a few hours to diagnose. One unanswered text is not a trend.</p><h2>What to actually do with the silence</h2><ol><li><strong>Do not send a clarifying text within the same day.</strong> If you have only been waiting a few hours, you have already decided he is ignoring you. That is anxiety, not data. Give it 24 hours minimum before you read anything into it.</li><li><strong>Stop rereading the last conversation.</strong> You already know what is there. Every time you reread it, you find something new to interpret. There is nothing new to interpret.</li><li><strong>Text something clean once, not something anxious multiple times.</strong> One message \u2014 normal, no subtext, no accusation \u2014 is fine. The second, third, fourth message is not a check-in. It is pressure.</li></ol><h2>The one question to ask yourself</h2><p>Not \"why is not he texting?\" \u2014 that is unanswerable. Ask: <strong>am I okay with how this person communicates, across time, if nothing changes?</strong></p><p>Not the current text. The pattern. If the answer is no \u2014 you know what to do with that.</p>",
    faqItems:[
      {q:"How long should I wait before texting after he stops texting back?",a:"At minimum 24 hours before you read anything into it. If it has been less than a day, you do not have data \u2014 you have anxiety. Give it time before you make the silence mean something."},
      {q:"Does he stop texting back because he is losing interest?",a:"Sometimes. But one unanswered text does not tell you that. What tells you is a pattern: consistently slow replies, one-word responses, never initiating. That is the signal. A single afternoon of silence is not it."},
      {q:"Should I take his silence as a sign?",a:"You should take it as information \u2014 not a verdict. Silence tells you he is not texting right now. It does not tell you why, and it does not tell you what it means long-term. Observe without concluding."},
      {q:"How do I stop spiraling when someone does not reply?",a:"The spiral is your attachment system trying to manage uncertainty by generating scenarios. The most effective interruption is physical \u2014 get away from the phone, do something with your body, change the environment. The text will still be there in an hour, and you will be better equipped to see it clearly."}
    ],
    prefill:"hey just wanted to check in and see if everything was okay on your end? not sure if i said something or if things are just busy but let me know"
  },
  'should-i-text-him-good-morning': {
    slug:'/should-i-text-him-good-morning', pageTitle:"Should I Text Him Good Morning \u2014 HoldOff",
    metaDesc:"The is this too much loop when you want to send a morning text. What good morning texts actually signal, and how to know if it is you trying to connect \u2014 or you trying to manage.",
    ogTitle:"Should I Text Him Good Morning", ogDesc:"The is this too much loop when you want to send a morning text. What good morning texts actually signal, and how to know if it is you trying to connect \u2014 or you trying to manage.",
    h1:"Should I Text Him Good Morning", lede:"You woke up. You thought about him. You are drafting a good morning text. Here is how to know whether to send it.",
    bodyContent:"<p>You woke up. You thought about him. You are drafting a good morning text.</p><p>But before you send it, there is a version of this that goes: <em>is this too much? is this too soon? does it make me look like I am waiting for him? is this going to be the text that shows him how into him I actually am?</em></p><p>That is not a relationship question. That is an anxiety question. Let us separate the two.</p><h2>What good morning texts actually are</h2><p>A good morning text is not inherently a lot. It is a normal human thing to do when you are thinking about someone. People in relationships text each other good morning. People who are dating text each other good morning. It is not the problem.</p><p>The problem \u2014 when it is a problem \u2014 is what the text is doing underneath the surface. Are you:</p><ul><li>Reaching out because you genuinely want to say good morning?</li></ul><p>Or:</p><ul><li>Reaching out because silence overnight feels like proof that something is wrong?</li><li>Checking to see if he will respond the way you need him to?</li><li>Creating a reason for contact so you do not have to sit with the question of where things stand?</li></ul><p>The text is the same in both cases. The motivation is not. And your nervous system knows the difference even when your brain is looking for reasons to justify it.</p><h2>The is this too much test</h2><p>Ask yourself: if he did not reply to this text, would you be okay? Or would you spend the next hour waiting for it, analyzing his last few messages, and drafting follow-up texts?</p><p>If you would be okay \u2014 send it. Normal morning. That is what it is.</p><p>If you would not be okay \u2014 do not send it today. Wait until you would be okay without the reply. That is the version of you that can text from a grounded place. That is the version worth protecting.</p><h2>What to actually write</h2><p>If you decide to text \u2014 keep it simple. Do not add qualifiers, explanations, or tests into a good morning message. It is not the place for that.</p><p>Good: \"morning :) hope your day is going well\"</p><p>Not good: \"hey i know we have not talked in a couple days but i just wanted to say good morning and see how you are doing because i have been thinking about us\"</p><p>The second one is trying to start a conversation you are not actually ready to have over text. It is trying to fix something, not just connect.</p><h2>The night version of this page</h2><p>This is the same pattern as the 11 PM spiral \u2014 the same loop, just in the morning instead of at night. The question is always the same: <em>am I reaching out because I want to, or because I cannot handle the uncertainty?</em></p><p>If you want to, text him. If you cannot handle the uncertainty, the text is not the answer.</p>",
    faqItems:[
      {q:"Is it too much to text him good morning?",a:"It depends on your state, not the text itself. If you would be fine without a reply, it is a normal morning text. If you would spend the next hour waiting, analyzing his last messages, and drafting follow-ups, you are texting from anxiety \u2014 not connection. That is the test."},
      {q:"When is the right time to start texting someone daily?",a:"When you genuinely have something to say each day, not when silence feels threatening. Daily texting should come from a place of ease, not anxiety management. If you are counting days or monitoring who texts first, the dynamic is already off."},
      {q:"How do I stop overthinking morning texts?",a:"The overthinking happens because the text is a proxy for a bigger question (where do we stand?). A morning text cannot answer that question \u2014 no single text can. If you find yourself drafting and redrafting a simple good morning, you are using the text to manage anxiety, not to connect."},
      {q:"Does texting first make me look too interested?",a:"People who are genuinely interested do not lose interest because you reached out. Texting first does not signal too much interest \u2014 it signals that you are a person who texts when you want to text. The fear of looking too eager usually means you are projecting your own anxiety about the dynamic onto him."}
    ],
    prefill:"good morning\! just wanted to check in and see how your week is going. been thinking about you :)"
  },
  'why-am-i-obsessing-over-his-last-text': {
    slug:'/why-am-i-obsessing-over-his-last-text', pageTitle:"Why Am I Obsessing Over His Last Text \u2014 HoldOff",
    metaDesc:"You cannot stop rereading his last message. The rumination loop \u2014 what is actually happening in your brain and how to interrupt it.",
    ogTitle:"Why Am I Obsessing Over His Last Text", ogDesc:"You cannot stop rereading his last message. The rumination loop \u2014 what is actually happening in your brain and how to interrupt it.",
    h1:"Why Am I Obsessing Over His Last Text", lede:"You know exactly what it says. You have read it fourteen times. This is the rumination loop \u2014 and it is not thinking.",
    bodyContent:"<p>You know exactly what it says.</p><p>You have read it fourteen times. You have read it out loud. You have searched for it in a thread to make sure you are remembering it right. You have a theory about what he meant and another theory about what he really meant.</p><p>This is the rumination loop. And it is not thinking \u2014 it is anxiety wearing the costume of thinking.</p><h2>What rumination actually is</h2><p>Rumination is not trying to solve a problem. It is trying to get certainty in a situation where certainty is not available yet. You keep reading the same words because you think the meaning will reveal itself if you just look hard enough.</p><p>It will not. The message says what it says. The rest is your brain filling in gaps with worst-case scenarios because anxious attachment treats ambiguity as a threat. The overthinking is not analysis \u2014 it is a safety behavior. Your nervous system is trying to predict a danger that may not exist.</p><h2>The what does it actually mean question</h2><p>Here is the truth nobody tells you: you can never know exactly what he meant by \"haha yeah that is fair\" or \"sorry was busy\" or \"hbd\" with a birthday cake emoji.</p><p>Text does not carry tone. Text does not carry the mood he was in when he wrote it. Text does not tell you whether he is thinking about you when he is not texting you. So every time you reread a message looking for a verdict \u2014 you are not finding one. You are generating one.</p><p>That generated verdict is usually the worst version. That is not a coincidence.</p><h2>The pattern you are in</h2><p>Obsessing over a text usually means you are using one message to answer a bigger question \u2014 like where this is going, whether he still likes you, or whether you messed something up. One text cannot answer those questions. Even a very warm text cannot \u2014 because the anxious part of your brain will find ambiguity in a hug.</p><h2>How to interrupt the loop</h2><ol><li><strong>Close the thread.</strong> Literally put the phone face-down and walk away from it. The rereading does not produce new data.</li><li><strong>Ask what you actually need.</strong> Not analysis \u2014 what do you actually need? A reply? A conversation? Consistency over time? That is not a text problem. That is a relationship conversation.</li><li><strong>Test the anxiety with something concrete.</strong> Instead of rereading, do something physical \u2014 go for a walk, call someone, cook something. The rumination loses steam when you engage your whole self instead of just the part that is stuck in the thread.</li><li><strong>See the pattern in other cases.</strong> Browse the examples gallery \u2014 you will see how many people are stuck in the exact same loop with different messages. The message changes. The pattern is the same.</li></ol><h2>The real answer</h2><p>His last text probably means exactly what it says and nothing more. That is almost always the case. The part you are reading into it is yours \u2014 not his.</p>",
    faqItems:[
      {q:"Why do I keep rereading his texts?",a:"Rereading is a safety behavior \u2014 your nervous system trying to extract certainty from a message that cannot provide it. Text does not carry tone, mood, or intent. Every time you reread looking for a verdict, you are generating one \u2014 usually the worst version. The rereading feels like analysis but it is anxiety management."},
      {q:"What does his texting pattern mean?",a:"Patterns mean more than individual messages. How quickly does he typically reply? Does he initiate? Does the warmth of his messages match yours? That is the data. A single text \u2014 even a confusing one \u2014 is not a pattern and cannot tell you what a pattern can."},
      {q:"How do I stop overanalyzing messages?",a:"The most effective interrupt is physical. Put the phone down, change your environment, engage your body. The rumination loop requires you to keep looking at the same words. If you break contact, the loop loses fuel. Come back when you are calmer \u2014 the message will look different."},
      {q:"Is he losing interest or am I overthinking?",a:"Usually both are true simultaneously \u2014 and neither can be diagnosed from one message. Look at the trend: is he less warm over time? Does he take longer to reply? Does he stop initiating? That is the data. One ambiguous text tells you nothing. The pattern tells you everything."}
    ],
    prefill:"yeah i think we're good"
  }
};

for (const [name, opts] of Object.entries(newPages)) {
  fs.writeFileSync('views/seo/' + name + '.ejs', buildSeoPage(opts));
  console.log('Wrote: views/seo/' + name + '.ejs (' + fs.statSync('views/seo/' + name + '.ejs').size + ' bytes)');
}

// Verify: confirm zero EJS tags in new pages
for (const name of Object.keys(newPages)) {
  const c = fs.readFileSync('views/seo/' + name + '.ejs', 'utf8');
  if (c.includes('<%') || c.includes('%>')) {
    console.log('FAIL: ' + name + ' still has EJS tags');
  } else if (c.includes('<\!DOCTYPE html>') && c.includes('</html>') && c.includes('FAQPage')) {
    console.log(name + ': OK (static HTML, no EJS)');
  } else {
    console.log(name + ': FAIL - missing structure');
  }
}

// Extra pages: 3 remaining failing pages
const extraPages = {
  'what-to-text-when-he-hasnt-replied': {
    slug:'/what-to-text-when-he-hasnt-replied', pageTitle:"What to Text When He Hasn't Replied — HoldOff",
    metaDesc:"He hasn't texted back. Here's what to actually send — and when not to send anything at all.",
    ogTitle:"What to text when he hasn't replied", ogDesc:"He hasn't texted back. The honest answer about what to send — and when silence is the better move.",
    h1:"What to text when he hasn't replied", lede:"The silence is loud. That's your nervous system, not him. Here's how to figure out if there's anything worth sending.",
    bodyContent:"<p>Nothing. For now.</p><p>The correct answer to \"what should I text when he hasn't replied\" is usually: nothing yet. Not because playing hard to get works — it doesn't, and it's exhausting — but because a text sent from anxiety almost never lands the way you want it to.</p><p>When he hasn't replied, the silence feels loud. Your brain offers you options: a casual follow-up, a question, a meme, a \"hey just checking in.\" All of them, sent from this state, carry the same subtext: <em>are you still there? am I still okay?</em> He'll feel that, even if the words seem neutral.</p><h2>How long is too long to wait?</h2><p>There's no clean rule, but here's a useful frame:</p><ul><li><strong>Under 24 hours:</strong> Don't send anything. This is just silence, not abandonment.</li><li><strong>1–3 days:</strong> Consider context — was the last exchange mid-conversation or did it reach a natural end? If mid-thread, a brief follow-up is okay. If it ended naturally, let it rest.</li><li><strong>3+ days:</strong> If you want to reach out, say something genuinely new — a real thing, not a check-in.</li></ul><h2>What to actually text (if you text)</h2><p>Something that doesn't require him to validate you. A real thought, a specific thing you wanted to share, something that moves the conversation forward — not one that restarts it by implying it ended badly.</p><p>Bad: \"Hey, haven't heard from you.\" (This is a guilt prompt.)</p><p>Bad: \"You okay?\" (This makes him the problem.)</p><p>Bad: \"lol did I say something wrong?\" (Fishing.)</p><p>Better: A genuine observation, a thing that made you think of him, a direct question about something real.</p><h2>What if the silence is the answer?</h2><p>Sometimes it is. If a pattern is emerging — he goes quiet, you reach out, he resurfaces — that pattern tells you more than any individual text. A message won't change a pattern. Behavior does.</p><p>More: <a href=\"/should-i-text-him-first\">should I text him first</a> and the full <a href=\"/filter\">HoldOff verdict tool</a>.</p>",
    faqItems:[
      {q:"What to text when he hasn't replied in 24 hours?",a:"Probably nothing yet. 24 hours is within normal response windows, especially for people who aren't glued to their phones. The anxiety you're feeling is information about you, not information about his feelings."},
      {q:"He hasn't texted back — should I double text?",a:"Wait at least 48 hours. If you do reach out, say something new — not a variation of 'did you see my message?' A follow-up that acknowledges the silence only draws attention to your discomfort."},
      {q:"What does it mean when a guy doesn't text back?",a:"Lots of things — busy, phone dead, overwhelmed, not interested, anxiety about what to say. One silence rarely means one specific thing. The pattern over time tells you more than any single instance."}
    ]
  },
  'should-i-text-him-first': {
    slug:'/should-i-text-him-first', pageTitle:"Should I Text Him First? — HoldOff",
    metaDesc:"The should I text him first loop. What the question is really asking, and how to decide from a grounded place.",
    ogTitle:"Should I text him first?", ogDesc:"The answer isn't about rules. It's about what state you're in when you're asking.",
    h1:"Should I text him first?", lede:"The answer isn't about rules. It's about what state you're in when you're asking.",
    bodyContent:"<p>The question behind the question</p><p>When you're asking \"should I text him first,\" you're usually not asking about etiquette. You're asking: <em>am I the only one trying here?</em> Or: <em>will reaching out make me look too eager?</em> Those are worth examining separately.</p><h2>On \"looking too eager\"</h2><p>The fear of looking too eager is real, but it's often a proxy for something else. You're not worried he'll lose interest because you texted first. You're worried he's already losing interest, and texting first will confirm it or accelerate it. The text itself isn't the problem.</p><p>People who are genuinely interested don't lose interest because you reached out. Texting first doesn't make you too available — it makes you a person who communicates.</p><h2>When to text him first</h2><ul><li>You have something real to say — not a pretext to restart the conversation</li><li>The last exchange ended naturally, not mid-thread</li><li>You're okay with whatever response comes (or doesn't)</li><li>You're not checking whether he still likes you</li></ul><h2>When not to text him first</h2><ul><li>You're hoping the text will reveal how he feels about you</li><li>You've already sent the last 2–3 messages in a row</li><li>It's past midnight and you're anxious</li><li>The reason you want to text is \"because I miss him\" with no actual content attached</li></ul><h2>The \"who texts first\" scorekeeping trap</h2><p>If you're counting who texts first, you're already in a dynamic that has more to do with anxiety than genuine connection. Healthy communication doesn't involve keeping score — it involves two people who both reach out when they have something to say. If it feels one-sided, the issue isn't who texts first. The issue is the imbalance underneath it.</p><h2>A grounded way to decide</h2><p>Ask yourself: what happens to my mood if I send this and he doesn't reply? If the answer involves dread, checking your phone every ten minutes, or rereading the message trying to figure out what went wrong — hold off. Send from a place where \"no response\" is manageable, not devastating.</p><p>Also useful: <a href=\"/what-to-text-when-he-hasnt-replied\">what to text when he hasn't replied</a> and the <a href=\"/filter\">full HoldOff tool</a>.</p>",
    faqItems:[
      {q:"Should I text him first or wait?",a:"Text first if you have something real to say and you're okay with whatever response comes. Wait if you're trying to manage anxiety, confirm he still likes you, or restart a conversation that ended naturally."},
      {q:"Is it okay to always text first?",a:"One-sided initiation is a pattern worth noticing, not a rule worth enforcing. If you're always the one reaching out, that's information about the dynamic — not a signal you should stop. Address the imbalance directly rather than withholding contact and hoping he notices."},
      {q:"Who should text first in a situationship?",a:"There's no rule. What matters: are you texting because you genuinely want to, or because you're trying to get a reaction? The second one usually generates more anxiety, not less."}
    ]
  },
  'why-do-i-overtext-when-anxious': {
    slug:'/why-do-i-overtext-when-anxious', pageTitle:"Why Do I Overtext When Anxious? — HoldOff",
    metaDesc:"Why you can't stop texting him when you're anxious — what's actually happening in your brain, and what actually helps.",
    ogTitle:"Why do I overtext when anxious?", ogDesc:"It's not a bad habit. It's your attachment system trying to manage uncertainty. Here's how it works.",
    h1:"Why do I overtext when anxious?", lede:"It's not a bad habit. It's your attachment system trying to manage uncertainty. Here's how it works.",
    bodyContent:"<p>It's a regulation attempt</p><p>You're not texting because you have something to say. You're texting because you're trying to make a feeling go away. The feeling is usually something in the anxiety family — uncertainty, rejection, the sense that something is wrong and you need to know right now.</p><p>Sending a message delivers a brief hit of relief. You've acted. The relief lasts about two minutes, then the waiting starts again — which is worse than before you sent it, because now you're waiting for a response too.</p><h2>What anxious attachment actually does</h2><p>Anxious attachment is a wiring, not a character flaw. It means your attachment system activates strongly and calms slowly. When someone important to you goes quiet, your brain interprets it as danger. The \"danger\" response bypasses the part of your brain that's good at long-term reasoning. What's left is urgency: do something, say something, confirm you're okay.</p><p>Texting feels like doing something. It's not. It's the attachment system pressing the same button again.</p><h2>Why \"just don't text\" doesn't work</h2><p>Because the urge is neurological, not logical. Telling yourself not to text is like telling yourself not to feel anxious. It doesn't work and makes you feel worse. What works is interruption — putting time between the urge and the action. Twenty minutes is often enough for the urgency to drop below the threshold where you'd make a decision you regret.</p><h2>What you can actually do</h2><ul><li><strong>Name it:</strong> \"I'm about to text from anxiety.\" Just naming it slows things down.</li><li><strong>Set a timer:</strong> 20 minutes. If you still want to text after, you can. Most times you won't.</li><li><strong>Run it through a filter:</strong> HoldOff reads the message and tells you what's actually in it. Seeing it named — \"this is reassurance-seeking\" — often kills the urge.</li><li><strong>Physical interrupt:</strong> Cold water, a few push-ups, a walk outside. Anxiety is in the body. Move the body.</li></ul><h2>The pattern worth watching</h2><p>If you notice you overtext with one person in particular, that's data. It's not that you have a texting problem — it's that this specific dynamic activates your attachment system strongly. That's worth understanding, not just managing.</p><p>More: <a href=\"/should-i-double-text\">should I double text</a> and the full <a href=\"/filter\">HoldOff verdict tool</a>.</p>",
    faqItems:[
      {q:"Why do I overtext when I'm anxious?",a:"Texting is a regulation attempt — a way to manage the discomfort of uncertainty. Anxious attachment makes your nervous system treat relational uncertainty as threat. Sending a message feels like doing something about the threat. The relief is brief; the anxiety returns."},
      {q:"How do I stop texting too much?",a:"You can't white-knuckle your way through it. The most effective approach is interruption: create time between the urge and the action. Use that time physically — get away from your phone, change your environment. The urgency drops significantly within 20 minutes."},
      {q:"Is overtexting a sign of anxious attachment?",a:"Often, yes. Anxious attachment makes you hypervigilant to signals from important people and slow to regulate when those signals are ambiguous. Overtexting is one of several common behavioral expressions. Others include excessive apologizing, reassurance-seeking, and reading into response times."}
    ]
  }
};

for (const [name, opts] of Object.entries(extraPages)) {
  fs.writeFileSync('views/seo/' + name + '.ejs', buildSeoPage(opts));
  console.log('Wrote: views/seo/' + name + '.ejs (' + fs.statSync('views/seo/' + name + '.ejs').size + ' bytes)');
}

for (const name of Object.keys(extraPages)) {
  const c = fs.readFileSync('views/seo/' + name + '.ejs', 'utf8');
  if (c.includes('<%') || c.includes('%>')) {
    console.log('FAIL: ' + name + ' still has EJS tags');
  } else if (c.includes('<\!DOCTYPE html>') && c.includes('</html>') && c.includes('FAQPage')) {
    console.log(name + ': OK (static HTML, no EJS)');
  } else {
    console.log(name + ': FAIL - missing structure');
  }
}

// Final failing page: 11pm-text-anxious-attachment
const finalPage = {
  '11pm-text-anxious-attachment': {
    slug:'/11pm-text-anxious-attachment', pageTitle:"Why Do I Text at Night? Anxious Attachment and the 11 PM Text — HoldOff",
    metaDesc:"Why anxious attachment makes you send texts at 11 PM — and what's actually happening in your brain when you do.",
    ogTitle:"Why do I text at night? Anxious attachment and the 11 PM spiral.", ogDesc:"Late-night texts aren't accidents. Here's the neuroscience of why — and what to do instead.",
    h1:"Why do I text at night? Anxious attachment and the 11 PM spiral.", lede:"It's 11 PM. You're writing a message you probably shouldn't send. Here's exactly why this happens — and what to do with the next 20 minutes.",
    bodyContent:"<p>It is 11 PM. You are writing a message you probably should not send.</p><p>Here is what is actually happening in your brain — and what to do with the next 20 minutes.</p><h2>Why nighttime makes it worse</h2><p>At night, the parts of your brain that manage impulse control and long-term thinking are at their lowest activity. The parts that generate emotional urgency are more active. That is not a character flaw — it is chronobiology. You are more likely to act on impulse at 11 PM than at 11 AM, regardless of how you feel about the text.</p><p>For anxious attachment specifically, nighttime removes the daytime noise that usually acts as a buffer. During the day you have work, social interaction, physical movement, tasks. At 11 PM, you have the dark and the silence and the thread. The attachment system has nothing competing with it.</p><p>That is why 11 PM texts feel urgent even when the content is not.</p><h2>What you are actually doing</h2><p>Late-night texts are almost always protest behaviors in disguise. You are not reaching out because you have something clear to say. You are reaching out because the silence feels like proof that something is wrong — and the message is a way of making the anxiety stop, not of communicating.</p><p>The text usually asks for something without naming it: <em>are you still there, am I okay, where do we stand?</em> It is doing emotional regulation work, not relationship work.</p><h2>The 20-minute rule</h2><p>The most effective intervention is the simplest: wait 20 minutes before sending anything at night. Not as willpower — as a test. Most late-night urges lose significant intensity within 20 minutes. Not because you have resolved anything, but because the activation spike passes.</p><p>If you still want to send it after 20 minutes, run it through HoldOff first. The verdict will tell you what is actually in the message. Most times, the answer is enough to hold off.</p><h2>What to actually do instead</h2><p>Put the phone in another room. Go do something physical — cold water, push-ups, a walk around the block. Do not browse the thread. Do not reread the message. Move your body. Anxiety is stored in the body; moving it interrupts the cycle.</p><p>If you cannot sleep: write the message in your notes app. Read it in the morning. You will usually delete it.</p><p>More: <a href=\"/should-i-double-text\">should I double text</a> and the full <a href=\"/filter\">HoldOff verdict tool</a>.</p>",
    faqItems:[
      {q:"Why do I text at night when I'm anxious?",a:"Impulse control weakens at night and your emotional brain runs louder. For people with anxious attachment, the nighttime quiet removes the daytime distractions that normally keep the attachment system from dominating. The result: late-night messages that feel urgent but rarely are."},
      {q:"What is a 3 AM text in anxious attachment?",a:"A 3 AM text is almost always a self-soothing attempt — a way to discharge anxiety by doing something. The relief is momentary. The regret is usually longer. If you cannot sleep and you want to text someone, write the message and wait until morning."},
      {q:"How do I stop sending late-night texts?",a:"The most reliable approach is interruption. Put your phone in another room or downstairs before 10 PM. If you are already in a spiral, use a tool like HoldOff to read what you are actually trying to say before you send it. The act of articulating it out loud often dissolves the urgency."}
    ],
    prefill:"ok so i know it's 2am and i probably shouldn't be texting but i've been thinking about us all night and i just need to know where this is going because i can't keep not knowing and it's making me crazy"
  }
};

for (const [name, opts] of Object.entries(finalPage)) {
  fs.writeFileSync('views/seo/' + name + '.ejs', buildSeoPage(opts));
  console.log('Wrote: views/seo/' + name + '.ejs (' + fs.statSync('views/seo/' + name + '.ejs').size + ' bytes)');
}

for (const name of Object.keys(finalPage)) {
  const c = fs.readFileSync('views/seo/' + name + '.ejs', 'utf8');
  if (c.includes('<%') || c.includes('%>')) {
    console.log('FAIL: ' + name + ' still has EJS tags');
  } else if (c.includes('<\!DOCTYPE html>') && c.includes('</html>') && c.includes('FAQPage')) {
    console.log(name + ': OK (static HTML, no EJS)');
  } else {
    console.log(name + ': FAIL - missing structure');
  }
}
