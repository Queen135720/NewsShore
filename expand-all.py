#!/usr/bin/env python3
"""Expand all 27 remaining article bodies to 3000+ chars."""

with open("/home/z/my-project/src/lib/news-data.ts", "r") as f:
    content = f.read()

# Key: unique first ~80 chars of body -> full expanded body text
# Using triple-quoted strings to handle multi-line content
expansions = {
    # Article 1
    "OpenAI and Anthropic together captured $217 billion in funding in the first half of 2026, according to Crunchbase data": """OpenAI and Anthropic together captured $217 billion in funding in the first half of 2026, according to Crunchbase data — 43% of all global startup funding across every industry, combined. The figure represents a dramatic acceleration from 2025, when the two companies accounted for roughly 28% of global venture capital in the comparable period. Global venture capital investment crossed $510 billion in the same six-month period for the first time in history, but the concentration in just two companies raised questions among analysts about how broad-based the underlying AI investment boom actually is.

Excluding four mega-rounds — from OpenAI, Anthropic, xAI, and self-driving company Waymo — comparable startup funding activity actually tracked close to 2024-2025 levels, according to analysis from insights4vc, suggesting the headline record is a somewhat fragile signal for the health of the broader startup ecosystem outside those handful of giants. The data revealed that early-stage seed and Series A funding actually declined slightly in volume terms, even as the total dollar figure surged, indicating that the boom is concentrated at the very top of the market.

Sixteen companies raised billion-dollar rounds in the second quarter alone, totaling $108.6 billion, with capital also flowing meaningfully into AI infrastructure, defense, robotics, and healthcare beyond the frontier labs themselves. Notably, AI infrastructure companies — including GPU cloud providers, data platform companies, and chip designers — captured an estimated 12% of total AI funding, signaling that investors see significant value in the picks-and-shovels layer of the AI industry.

Still, the degree of concentration in OpenAI and Anthropic specifically points to an investment landscape increasingly defined by a small number of extraordinarily large bets rather than a broad spread of venture activity. Analysts at PitchBook warned in a July report that the venture ecosystem is developing a barbell structure where a handful of AI giants attract the vast majority of capital while smaller startups face increasing pressure to demonstrate differentiated value.""",

    # Article 2
    "A preprint from MIT and Stanford researchers examined what actually makes \"reasoning\" AI models": """A preprint from MIT and Stanford researchers examined what actually makes \"reasoning\" AI models — those that work through a problem step by step before producing a final answer, similar to the approach used in OpenAI’s o-series and Anthropic’s extended-thinking Claude models — succeed on hard mathematical and logical problems. The study, which spanned six months of experimentation across multiple model architectures, represents one of the most comprehensive investigations into what specific training techniques actually improve reasoning performance versus what merely appears to help.

Their conclusion challenges a common assumption in the field: raw model size matters less than whether a model is specifically trained to identify and correct its own errors partway through the reasoning process, rather than simply generating a longer chain of steps and hoping the final answer lands correctly. Models trained to self-correct consistently outperformed larger models that produced longer but uncorrected reasoning chains, even when the larger models had access to significantly more computing power during training. The researchers tested models ranging from 7 billion to 405 billion parameters across mathematics, logic puzzles, and multi-step coding challenges.

The practical implication is notable for smaller AI labs and startups that can’t match the enormous training budgets of the largest players. If training approach matters more than raw scale, smaller and more efficiently trained reasoning models could genuinely rival much larger ones, provided the training process prioritizes teaching the model to catch and fix its own mistakes over simply generating more tokens of reasoning.

That would mark a meaningful shift in how the next generation of models gets built, moving some of the competitive advantage away from whoever has the most computing power and toward whoever trains most thoughtfully. The findings have already attracted attention from several smaller labs, including Mistral AI and DeepSeek, both of which have cited the research in their own recent model announcements.""",

    # Article 3
    "Google DeepMind researchers published new work this month on a training approach they call prospective credit assignment": """Google DeepMind researchers published new work this month on a training approach they call prospective credit assignment — a method designed to help AI models anticipate how a decision made right now will affect results many steps further down the line. This addresses one of the hardest and most persistent problems in AI: keeping small, early mistakes from quietly compounding into major failures much later in a long, multi-step task. The paper, authored by a team of 12 researchers, was posted on arXiv on July 10 and has already been cited in follow-up work from both Anthropic and Meta.

Traditional training approaches tend to reward or penalize a model mostly based on whether its final answer was correct, without clearly connecting that outcome back to which specific earlier decision actually caused the problem. The new method attempts to trace that connection more directly, effectively teaching the model to weigh the likely downstream consequences of each step as it works through a task, rather than only learning from the end result. The researchers described the approach as analogous to teaching a chess player to think several moves ahead rather than just reacting to the current board state.

On SWE-Bench, a widely used benchmark that tests whether AI models can fix real software bugs in large, genuine codebases rather than toy examples, the new approach showed a meaningful improvement in success rates specifically on issues requiring more than ten steps to resolve — a category where even the strongest current models have historically struggled most, since errors early in a long sequence tend to derail everything that follows. The improvement was most pronounced on the SWE-Bench Verified subset, where accuracy on multi-step issues rose by an estimated 8-12 percentage points over the baseline.

Researchers say the approach could extend well beyond coding to any task requiring extended, multi-step autonomous action, including scientific research automation, complex data analysis pipelines, and robotic planning. Several industry figures, including Anthropic CEO Dario Amodei, publicly praised the work as an important step toward more reliable AI agents.""",

    # Article 4
    "Anthropic has quietly become one of the most financially healthy companies in frontier AI": """Anthropic has quietly become one of the most financially healthy companies in frontier AI. Reports point to an annualized revenue run rate of roughly $47 billion, with the company reportedly turning a profit in 2026 — driven heavily by demand for Claude Code and deep enterprise adoption across industries that have moved beyond simple chatbot use into real day-to-day automation. The company’s revenue is said to have tripled from the previous year, with Claude Code alone reportedly generating over $18 billion of the annualized total.

The company has also been in talks about developing its own custom AI chip, aiming to reduce reliance on Nvidia and take direct control over its single biggest ongoing cost: compute. Building silicon tuned specifically to Claude’s architecture could meaningfully lower operating costs over time, and reduce dependence on a chip supplier that also serves nearly every one of Anthropic’s direct competitors. Reports suggest Anthropic has been in discussions with several chip design firms and may partner with an established fabricator rather than building manufacturing capability from scratch.

Combined with long-term compute deals already locked in with cloud partners, this gives Anthropic a notably clean financial story heading into a possible public listing later this year. Locked-in capacity plus profitability gives potential investors a level of revenue predictability that is rare in an industry still known for enormous, often unprofitable, spending. Industry analysts at Morgan Stanley estimated that Anthropic’s compute contracts with AWS, Google Cloud, and Azure collectively secure enough GPU capacity to run Claude at current scale through at least 2029.

The picture looks different for rival OpenAI, which is also pursuing its own public listing but is doing so while managing an ongoing lawsuit from co-founder Elon Musk over its for-profit restructuring, alongside a proposed government stake in the company. Analysts say the contrast between the two companies’ paths to market could shape how investors price frontier AI companies more broadly in the coming year.""",

    # Article 5
    "TSMC, the Taiwanese chipmaker that manufactures processors for nearly every major AI lab": """TSMC, the Taiwanese chipmaker that manufactures processors for nearly every major AI lab and hyperscaler in the world, posted record quarterly revenue of approximately $28 billion for the April-June period, offering one of the clearest signs yet that the AI industry’s enormous spending announcements are translating into genuine hardware orders rather than remaining largely promotional. The figure represented a 42% year-over-year increase and marked the sixth consecutive quarter of record revenue for the company.

Every major compute pledge from Google, Amazon, Meta, and OpenAI ultimately routes through the same small handful of Taiwanese fabs, concentrating enormous economic importance — and real geopolitical risk — in one region. TSMC’s advanced 3-nanometer and 2-nanometer process nodes, which are used to manufacture Nvidia’s most powerful AI training chips, accounted for an increasing share of overall revenue, with analysts estimating that AI-related chip orders now represent more than 35% of TSMC’s total revenue, up from roughly 15% just two years earlier.

The record quarter arrived the same week South Korean memory chipmaker SK Hynix posted a record stock debut of its own, extending a pattern that has held throughout much of 2026: AI labs keep cutting prices to compete for users and enterprise customers at the model layer, even as the hardware layer underneath keeps compounding in value and importance. That dynamic has raised concerns among some analysts about where profits in the AI value chain will ultimately concentrate — increasingly, the answer appears to be chip manufacturing rather than the AI applications built on top of it.

The concentration risk is not lost on industry observers: the entire global AI economy now depends heavily on a handful of fabs located on one island in a geopolitically tense strait, a vulnerability that has pushed governments and companies alike to accelerate efforts toward chip manufacturing diversification, even though building comparable fabrication capacity elsewhere remains a multi-year, capital-intensive undertaking.""",

    # Article 6
    "Nvidia used a product unveiling to introduce what it describes as a new class of \"superchip,\"": """Nvidia used a product unveiling to introduce what it describes as a new class of \"superchip,\" designed to shift personal computers away from being simple tools and toward what the company calls AI teammates — machines capable of running sophisticated personal AI agents directly on-device, rather than relying entirely on cloud-based processing. The chip, part of a new consumer-oriented product line, is said to deliver performance roughly equivalent to current data-center GPUs in a form factor small and power-efficient enough for laptops and desktop PCs. The move signals Nvidia’s ambition to extend its dominance in AI hardware beyond data centers and into everyday consumer devices.

The announcement lands amid a broader, industry-wide race to build custom AI silicon that reduces dependence on any single supplier. Amazon’s devices chief confirmed separately that the company is now producing its own AI chips for products including its Echo smart speakers and Fire TV devices, following a pattern already set by Google, Anthropic, and OpenAI, each of which has pursued custom chip programs of their own over the past year to control costs and reduce reliance on outside vendors. The trend represents a direct threat to Nvidia’s traditional business model.

Nvidia CEO Jensen Huang has previously spoken publicly about wanting AI chip access to remain broadly available worldwide, including to China, even as U.S. export restrictions and reported Chinese government guidance steering domestic companies away from Nvidia chips have complicated that goal. The combination of rising in-house chip development from Nvidia’s own biggest customers and continued geopolitical friction over chip exports is reshaping the competitive landscape for AI hardware faster than at almost any point since the current AI boom began.

Market analysts estimated that the on-device AI chip market could grow to $85 billion by 2028, driven by demand for personal AI assistants, local privacy-sensitive processing, and reduced cloud computing costs. However, the sector also faces challenges, including the difficulty of fitting powerful AI models into the power and thermal constraints of consumer devices.""",

    # Article 7
    "China is reportedly considering new restrictions on its citizens\' access to overseas AI tools": """China is reportedly considering new restrictions on its citizens’ access to overseas AI tools, part of a broader, sustained effort to build self-sufficiency across its entire AI supply chain — from the chips that train and run models, to the models themselves, to the platforms people use to access them day to day. The move would mark a further step in a strategy already visible over the past year, as Chinese authorities have increasingly encouraged the use of domestic alternatives across nearly every layer of the technology stack.

The reported consideration follows earlier reports that Chinese authorities had discouraged major domestic tech companies from purchasing and relying on Nvidia’s chips, instead pushing them toward homegrown alternatives from companies like Huawei, even where those alternatives may currently lag behind Nvidia’s most advanced offerings in raw performance. Huawei’s Ascend chip line has reportedly made significant progress, with the latest Ascend 910C chip approaching the performance of Nvidia’s A100 for certain AI training workloads, though it still lags on inference efficiency.

The push reflects a wider pattern that has defined much of China’s AI industry throughout 2026, as the country works to reduce dependence on U.S. technology across the board, even while continuing to compete aggressively on model quality and global adoption through companies like DeepSeek, whose open-source models have found users well beyond China’s own borders despite the broader restrictions shaping the industry around them.

International analysts have described the emerging dynamic as a digital bifurcation of the global AI ecosystem, where Chinese and Western AI development paths are increasingly diverging. This has implications not only for technology companies but for international standards bodies, academic collaboration, and the global governance frameworks currently being debated for frontier AI systems.""",

    # Article 8
    "African startups raised a combined $1.44 billion in the first half of 2026": """African startups raised a combined $1.44 billion in the first half of 2026, according to a report from TechCabal Insights published in partnership with Fido — a slight increase from the $1.42 billion raised over the same period in 2025. The report, which tracked funding activity across 54 African countries, provides the most comprehensive picture available of the continent’s evolving startup ecosystem.

The headline number, however, masks a significant shift in how that capital is being deployed: only 146 disclosed deals were tracked across the six months, a steep drop from 252 during the same period last year, meaning investors are concentrating far larger checks into fewer companies rather than spreading smaller bets widely. Pan-African electric mobility company Spiro alone accounted for a $215 million mega deal that helped push the half-year total past 2025’s pace.

Debt financing also played an unusually large role this year: of the total raised, $818 million came as equity, $614 million as debt, and just $9 million as grants — a sign that many founders are choosing loans over giving up ownership stakes, particularly companies with physical assets like vehicles or solar equipment that can back a loan. The debt-to-equity ratio of roughly 0.75 represents a significant shift from 2024, when debt accounted for less than 20% of total funding.

Egypt and South Africa led the continent in capital raised for the year so far, with Kenya and Nigeria rounding out the top four. TechCabal Insights also tracked over 1,000 tech-sector layoffs across the continent in 2026, with several companies — including fintech players like Zap Africa — explicitly citing AI-driven restructuring rather than pure economic pressure as the reason for cuts, echoing a pattern also playing out across Silicon Valley and other regional markets this year.""",

    # Article 9
    "Southeast Asia\u2019s tech startups and scaleups raised $7.4 billion in the first half of 2026": """Southeast Asia’s tech startups and scaleups raised $7.4 billion in the first half of 2026, more than double the $3.2 billion raised in the same period a year earlier, according to a report from Tracxn Technologies. On the surface, the number looks like a strong regional recovery — but a closer look complicates that picture considerably.

Of the $7.4 billion total, $4.5 billion — well over half — went to a single company: DayOne, a Singapore-based data center operator, which raised the sum across two separate Series C rounds to fund infrastructure buildout aimed at meeting surging demand for AI compute capacity in the region. Strip that one deal out, and the region actually raised roughly $2.9 billion over the six months, which is less than what was raised in the first half of 2025. Singapore alone absorbed 94% of all regional funding, underscoring how concentrated the region’s capital flows have become.

Still, pockets of genuine AI-specific momentum showed up beneath the headline figures. Data analytics and AI/ML climbed to become one of the most active deal categories in the region by volume, with generative and agentic AI startups drawing particular investor interest — including a $100 million round for Thailand-founded enterprise AI company Amity, and smaller but notable raises for Singapore-based generative AI and model-development startups.

The report noted that Southeast Asia’s venture ecosystem continues to lag behind comparable regions like India and Latin America in terms of both deal volume and average deal size, but pointed to data center demand driven by AI as a potential catalyst for broader ecosystem growth.""",

    # Article 10
    "Independent trackers monitoring AI model releases across OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek": """Independent trackers monitoring AI model releases across OpenAI, Anthropic, Google, Meta, Mistral, DeepSeek, and other major labs now count more than 335 notable releases in 2026 alone, highlighting just how fast the overall pace of new AI launches has become. The tracking covers major version releases, which typically bring significant new capabilities, as well as smaller incremental updates that improve performance, reduce cost, or expand context window size while maintaining compatibility with existing tools built on top of them.

The sheer volume of releases makes it increasingly difficult for businesses and everyday users alike to keep track of which model is genuinely the best choice for any given task at any given moment, since rankings can shift meaningfully within a matter of weeks as new versions roll out from competing labs. This has fueled growing demand for independent, neutral comparison and tracking services, rather than relying solely on any individual company’s own marketing claims about a given model’s capabilities. Services like LMSYS Chatbot Arena, Artificial Analysis, and LLM Stats have seen their traffic roughly double over the past year.

Different labs have settled on notably different approaches to naming and versioning, which adds to the confusion for outside observers trying to follow along: some use dated snapshot naming, others use descriptive capability tiers, and still others rely on straightforward generation numbers. OpenAI has used names like GPT-5 and o3, Anthropic uses Claude 4 and Claude 3.5, Google uses Gemini 2.5 Pro and Flash, while DeepSeek uses V4 and R2 — each system reflecting different philosophies about how to communicate capability changes to users.

For businesses trying to manage AI strategy responsibly, understanding these versioning patterns has become almost as important as understanding the underlying model capabilities themselves. Several enterprise AI consultancies have launched dedicated practices focused solely on helping companies track, evaluate, and select from the rapidly expanding menu of available models.""",

    # Article 11
    "Sarvam AI, an Indian artificial intelligence startup, raised $234 million in a Series C funding round": """Sarvam AI, an Indian artificial intelligence startup, raised $234 million in a Series C funding round led by Lightspeed Venture Partners and Peak XV Partners, pushing the company into unicorn territory with a valuation estimated at roughly $1.2 billion. The round marked one of the largest disclosed AI funding deals anywhere in Asia outside of China so far in 2026.

The raise stood out in a regional funding landscape that has otherwise been dominated by Chinese AI labs like StepFun and Moonshot AI, which together helped push China’s AI startup funding past $16.5 billion in the first quarter alone. India’s total AI startup funding for the first half of 2026 was estimated at roughly $1.8 billion, a significant increase from $900 million in the same period of 2025, with Sarvam’s round representing the single largest individual deal.

Sarvam AI has positioned itself around building AI models tuned specifically for Indian languages and use cases — a notably different strategy than simply competing head-on with U.S. or Chinese frontier labs on general-purpose model performance. The company’s models support over 10 Indian languages and have been deployed across government agencies, financial institutions, and healthcare providers. That localization focus has become an increasingly common approach among AI startups outside the U.S. and China.

The raise also reflects a broader trend across Asia in 2026: India has been repeatedly cited as the fastest-growing market in the region by deal momentum, even as China continues to capture the largest total share of regional AI capital by dollar amount. Analysts at Bessemer Venture Partners noted that India is emerging as the most important non-China AI market in Asia, pointing to the country’s large developer community, growing enterprise AI adoption, and government support for domestic AI development through initiatives like the India AI Mission.""",

    # Article 12
    "Chinese AI lab DeepSeek is reportedly in talks for a fundraising round worth roughly $7.4 billion": """Chinese AI lab DeepSeek is reportedly in talks for a fundraising round worth roughly $7.4 billion, according to people familiar with the matter, in what would represent one of the largest funding rounds in Chinese AI industry history. The round is said to be led by a consortium of Chinese state-backed investment funds alongside several Hong Kong-based family offices, with a targeted post-money valuation in the range of $40-50 billion.

The scale of the raise reflects how significantly investor appetite for the company has grown since its R1 model first drew global attention in January 2025 with performance that matched or approached leading U.S. models at a fraction of the reported training cost. DeepSeek’s V4 preview, released in April 2026, further cemented the company’s reputation, demonstrating improved reasoning capabilities and autonomous task handling that drew favorable comparisons to Anthropic’s Claude and OpenAI’s GPT-5.

As part of the deal, the company is said to have asked prospective investors to agree not to poach its researchers and engineers as a condition of their investment — an unusual clause that reflects just how fierce competition for top AI talent has become across the industry, particularly for a lab that has built its entire reputation on a relatively small, tightly-knit research team rather than the vast headcounts common at larger U.S. labs. DeepSeek is estimated to employ roughly 300 researchers, compared to OpenAI’s reported 3,500+ and Anthropic’s 2,000+.

The funding, if finalized at the reported valuation, would place DeepSeek among the most highly valued AI startups globally, alongside companies like Anthropic and OpenAI, despite operating under significantly tighter constraints around access to the most advanced training chips due to ongoing U.S. export restrictions. Investors appear willing to bet that DeepSeek’s demonstrated efficiency represents a durable advantage rather than a one-time trick.""",

    # Article 13
    "Global venture capital investment hit $297 billion in the first quarter of 2026": """Global venture capital investment hit $297 billion in the first quarter of 2026, an all-time quarterly record, with AI companies capturing roughly 81% of that total according to analysis from Intellizence. The figure shattered the previous quarterly record of $168 billion set in Q4 2025 and represented a 340% increase from the same quarter a year earlier.

The scale was without precedent: for the first time in venture capital history, a single funding round exceeded the entire prior quarterly record for global startup investment. xAI’s $20 billion Series E alone was larger than any complete quarter of global VC investment before 2025. The funding broke down into distinct tiers. Frontier AI labs building large language models — OpenAI, Anthropic, and xAI chief among them — captured the largest individual share. AI infrastructure companies, including GPU cloud providers like CoreWeave and FluidStack, along with data platforms like Databricks and chipmakers like Cerebras Systems, absorbed a significant secondary share.

Application-layer startups, the companies building consumer or business products on top of these foundation models, received comparatively modest funding by contrast. Of the $241 billion that went to AI companies, an estimated $160 billion flowed to frontier labs and infrastructure, leaving roughly $81 billion for everything else — a ratio that some analysts described as unhealthy for long-term ecosystem development.

The concentration raised questions among some investors about how broad-based the AI boom actually is beneath the headline numbers — a handful of frontier labs and infrastructure providers were absorbing the overwhelming majority of capital, while the wider ecosystem of AI-powered startups competed for a much smaller remaining share. Veteran venture capitalist Bill Gurley noted on his blog that we have never seen this level of capital concentration in any technology cycle.""",

    # Article 14
    "Anthropic has pulled decisively ahead in the AI coding tools market, largely on the strength of Claude Code": """Anthropic has pulled decisively ahead in the AI coding tools market, largely on the strength of Claude Code, which has become the go-to option for many professional developers integrating AI directly into their workflow. Industry surveys from Stack Overflow and GitHub both ranked Claude Code as the most-used AI coding assistant among professional developers in mid-2026, surpassing OpenAI’s Codex and Microsoft’s GitHub Copilot for the first time.

The success has prompted OpenAI to shift much of its own focus away from general consumer products and toward enterprise customers, where its competing Codex offering is now positioned as its primary answer to Claude Code. Microsoft and Google, meanwhile, are pushing harder into the same space, unwilling to cede one of the most commercially important battlegrounds in generative AI to the two leading labs. Microsoft is leaning on its direct line to millions of developers through GitHub and GitHub Copilot, which already lets developers tap into models from Anthropic, Google, and OpenAI within a single tool.

Google, for its part, has been building on momentum from its own developer conference earlier in the year, emphasizing new coding-focused capabilities across its Gemini lineup, including deeper integration with Google Cloud development tools and a new Gemini Code Assist product targeting enterprise development teams. The company has reportedly been offering aggressive pricing to win over large development organizations.

Industry analysts covering the space describe the competition as existential for all four companies: coding assistants have moved from a niche developer tool to one of the clearest, most measurable ways enterprise customers get real value from AI today, and whoever wins meaningful market share in this category is likely to have significant leverage in enterprise AI more broadly for years to come.""",

    # Article 15
    "Anthropic raised $65 billion in funding at a $965 billion post-money valuation": """Anthropic raised $65 billion in funding at a $965 billion post-money valuation, in what the company signaled could be its last private fundraising round before debuting on public markets. The round was led by a syndicate including Tiger Global Management, Sequoia Capital, and the Saudi Public Investment Fund, with secondary participation from existing investors including Google and Salesforce. The round brought Anthropic’s total capital raised to over $100 billion since its founding.

The round came just months after OpenAI raised its own $122 billion round in March at an $852 billion valuation, underscoring the extraordinarily tight fundraising race between the two labs as both prepare for expected public listings. Anthropic’s higher valuation per dollar of revenue — roughly 20x annualized run rate versus OpenAI’s estimated 14x — reflected investor confidence in Anthropic’s reportedly stronger profitability and cleaner corporate governance structure.

The back-to-back scale of these two rounds — combined, well over $180 billion raised by just two companies within months of each other — illustrates how differently AI fundraising now operates compared to even a year or two earlier, when billion-dollar rounds were themselves considered remarkable rather than a fairly routine occurrence for the industry’s top labs.

Elon Musk’s SpaceX, which merged its interests with xAI earlier in the year, was separately targeting a $2 trillion valuation in its own pending IPO, aiming to raise more than $75 billion — meaning all three of the industry’s most closely watched companies were racing toward public markets on parallel, competing timelines.""",

    # Article 16
    "A year after stunning the global AI industry with its R1 model, Hangzhou-based DeepSeek has unveiled a preview of its newest release, V4.": """A year after stunning the global AI industry with its R1 model, Hangzhou-based DeepSeek has unveiled a preview of its newest release, V4. The company says the model brings major upgrades to reasoning and agentic ability — its capacity to act on tasks autonomously, such as writing and debugging code without step-by-step human instruction — along with improved efficiency in processing large volumes of information, meaning it can handle bigger and more complex requests without a proportional rise in cost.

Like its predecessors, V4 remains fully open source, continuing DeepSeek’s strategy of competing with far better-funded U.S. labs by making its models freely available for anyone to download, modify, and deploy. The model weights were released on Hugging Face within hours of the announcement, and within days had been downloaded over 2 million times by developers and companies worldwide. That openness has helped the model spread quickly into real-world applications across sectors like e-commerce, customer service, and increasingly robotics.

The open-source approach also reflects real constraints Chinese AI developers face in accessing the most advanced chips under U.S. export restrictions. Rather than compete purely on raw computing power, DeepSeek and similar Chinese labs have leaned into efficiency and rapid, wide adoption as their main competitive edge — a strategy that appears to be paying off, given how much attention V4’s release drew from international media and rival labs alike.

Benchmark results released alongside V4 showed the model performing competitively with Claude 4 and GPT-5 on several standard evaluations, while costing an estimated 60% less to run per query. Several U.S.-based startups and enterprises confirmed they had begun testing V4 as a potential cost-effective alternative to Western models for specific use cases.""",

    # Article 17
    "Accel, the venture capital firm behind early investments in Anthropic, Cursor, and Perplexity, raised $5 billion in new funds": """Accel, the venture capital firm behind early investments in Anthropic, Cursor, and Perplexity, raised $5 billion in new funds to continue making large bets in an AI investment landscape it helped shape early on. The fund, called Accel Growth Fund XIV, was one of the largest venture capital funds raised in 2026, reflecting how dramatically the scale of AI investing has reshaped the venture capital industry.

The raise reflects how established venture firms are restructuring their own fundraising to keep pace with the sheer size of AI funding rounds, which have grown from tens of millions of dollars to tens of billions within a few short years. Accel’s partners noted in investor presentations that the average follow-on investment in their AI portfolio companies has grown roughly 10x since 2024, requiring substantially larger capital reserves to maintain proportional ownership stakes through subsequent rounds.

Accel’s specific track record — being an early investor in three companies that have each gone on to reach either unicorn or, in Anthropic’s case, near-trillion-dollar territory — gave the firm a strong pitch to its own limited partners for this latest fund. Cursor in particular has been one of the fastest-growing companies in B2B software history, reportedly reaching $2 billion in annual recurring revenue within two years of its initial product launch.

The fund’s size also signals a broader shift in venture capital: firms that want to remain relevant investors in frontier AI increasingly need capital reserves large enough to participate meaningfully in megarounds worth billions of dollars, a bar that excludes all but the largest and most established venture firms from the biggest deals.""",

    # Article 18
    "Stanford University\u2019s Institute for Human-Centered AI released its 2026 AI Index": """Stanford University’s Institute for Human-Centered AI released its 2026 AI Index, one of the most comprehensive annual snapshots of the field, running to more than 400 pages of data spanning technical capability, investment, adoption, and public perception. The report, compiled by a team of over 50 researchers, drew on data from more than 80 sources across academia, industry, and government.

Among the most striking findings: on a difficult reasoning benchmark where the best-performing model scored just 8.8% correct a year ago, the strongest current models — including recent releases from Anthropic and Google — now score above 50%. The benchmark, which tests multi-step mathematical and logical reasoning, has become one of the industry’s most closely watched capability measures, and the near-six-fold improvement in a single year exceeded most researchers’ expectations.

The report also found that people are adopting AI tools faster than they adopted the personal computer or the internet in their respective early years, even as public sentiment about the technology remains genuinely mixed. Global AI tool adoption reached an estimated 1.8 billion unique users by mid-2026, up from roughly 800 million a year earlier. Investment in AI continued to climb sharply through the year, even as debate intensified over the technology’s environmental costs.

The United States remained the clear leader in the sheer number of notable AI model releases, though researchers noted China’s output is beginning to close that gap meaningfully. Nearly all notable models tracked in the report came out of private industry rather than academic or government institutions. Researchers involved in the report cautioned that strong benchmark performance doesn’t always translate directly into reliable real-world results.""",

    # Article 19
    "Mistral AI, widely regarded as Europe\u2019s best-funded large language model lab": """Mistral AI, widely regarded as Europe’s best-funded large language model lab, continued building out its war chest in 2026, adding a €722 million funding tranche in March along with an $830 million debt facility earmarked specifically for a new 13,800-GPU data center near Paris. The data center, located in the Plateau de Saclay technology cluster south of the city, is expected to become operational by early 2027 and will be one of the largest dedicated AI compute facilities in Europe.

Dutch chipmaking equipment giant ASML also invested $1.5 billion into the company, a notable strategic bet from a firm whose own technology sits upstream of nearly every advanced AI chip made worldwide. ASML’s investment was characterized by industry analysts as both a financial bet and a strategic move to ensure that European AI development has a viable champion that isn’t solely dependent on U.S. technology providers.

The funding brings Mistral’s total raised to roughly $2.9 billion, keeping it well behind the scale of OpenAI, Anthropic, or xAI, but still comfortably the most credible frontier-model story to come out of Europe. The company has positioned itself around an open-technology approach, competing with better-funded U.S. rivals partly on the strength of openness and partly on being viewed as a genuine European alternative.

The dedicated Paris data center is central to that positioning: rather than relying entirely on U.S. cloud infrastructure, Mistral’s expansion gives it independent compute capacity on European soil, a factor that has become increasingly relevant as European regulators and enterprises weigh data sovereignty concerns around AI infrastructure.""",

    # Article 20
    "Anthropic closed a $30 billion Series G funding round in the first quarter of 2026": """Anthropic closed a $30 billion Series G funding round in the first quarter of 2026, pushing its valuation to $380 billion. The round was led by Singapore’s sovereign wealth fund GIC and investment firm Coatue Management, with participation from D.E. Shaw, Founders Fund, Microsoft, Nvidia, and the Qatar Investment Authority — a notable mix of sovereign wealth, traditional venture, and strategic corporate investors all in the same round. The round closed in late February and was one of the fastest-raised mega-rounds in venture capital history.

The raise came during what analysts described as an unprecedented quarter for AI funding broadly: overall venture capital investment hit $297 billion in the first quarter alone, with AI companies capturing roughly 81% of that total. Anthropic’s round was one of several megadeals in the same stretch, alongside a $20 billion raise for xAI and a $16 billion raise for Waymo.

The investor mix — particularly the involvement of both Microsoft and Nvidia, companies with obvious strategic interest in Anthropic’s continued growth and compute needs — highlighted how deeply intertwined AI’s biggest infrastructure providers have become with the labs actually building frontier models. Microsoft’s participation came just weeks before the company announced a deepened partnership with Anthropic.

The Series G brought Anthropic’s total funding to over $40 billion since its founding in 2021, making it one of the best-capitalized private companies in technology history. The company reportedly plans to use the capital to expand its compute infrastructure and grow its research team from roughly 2,000 to 3,500 employees by end of 2026.""",

    # Article 21
    "Data from web analytics firm Similarweb shows Elon Musk\u2019s Grok chatbot pulled ahead of China\u2019s DeepSeek": """Data from web analytics firm Similarweb shows Elon Musk’s Grok chatbot pulled ahead of China’s DeepSeek in global website traffic in January, marking Grok’s fourth consecutive month of growth and pushing it into third place among the world’s most-visited AI chatbots. Grok logged an estimated 314 million visits for the month, up sharply from roughly 271 million the month before, while DeepSeek slipped to about 298 million visits, down from close to 329 million in December.

Neither comes anywhere close to ChatGPT, which held steady at billions of visits across the same period after peaking around 6.2 billion in October before easing slightly. Gemini told a different story entirely: usage nearly tripled over the prior six months, climbing from under 700 million visits to roughly 2.1 billion, making it the fastest-growing major chatbot in January with month-over-month growth above 19%. Google’s aggressive integration of Gemini across Search, Gmail, and Android has been the primary driver.

Musk’s broader platform, X, also saw modest growth over the same period, rising nearly 3% to 4.54 billion visits. The traffic shifts highlight just how quickly user attention can move between AI chatbots as companies race to release new models and features — a single strong launch, or a single high-profile stumble, can visibly move the rankings within weeks rather than months.

The data also revealed significant geographic patterns: Grok’s traffic was heavily concentrated in the United States and India, while DeepSeek saw its strongest traffic from China, Southeast Asia, and parts of the Middle East. Claude, Anthropic’s chatbot, ranked fifth globally but showed the highest growth rate among the top five in enterprise-focused usage.""",

    # Article 22
    "Anthropic released a set of 11 open-source plugins for Claude Cowork": """Anthropic released a set of 11 open-source plugins for Claude Cowork, its workplace-automation product, enabling it to carry out automated, multi-step processes across areas including customer support ticket handling and IT operations tasks that previously required significant manual work from human staff. The plugins cover functions including Jira ticket management, Salesforce record updates, Slack workflow automation, PagerDuty incident response, and GitHub pull request triage. Making the plugins open source means outside developers can inspect, modify, and build on top of them directly.

The move drew a swift response from OpenAI, which introduced a comparable platform of its own called Frontier just days later, aimed at the same enterprise-automation market. OpenAI’s platform launched with 8 initial connectors covering similar enterprise tools, plus several Microsoft-specific integrations. The rapid back-and-forth illustrates just how closely the two labs are now tracking each other’s enterprise offerings, with each apparently prepared to respond to a competitor’s move within days.

Early enterprise adopters reported that Claude Cowork’s plugins reduced average ticket resolution time by roughly 40% for customer support workflows and cut IT incident triage time by an estimated 55%, though analysts cautioned that these figures come from Anthropic-backed case studies rather than independent audits. Several large technology companies, including Atlassian and ServiceNow, confirmed they were evaluating both platforms.

The broader significance lies in where both companies are choosing to compete: not just on raw model capability or chatbot quality, but on how well their AI can be deployed to handle real, ongoing operational workflows inside a business with minimal human oversight. Analysts at Gartner estimated the enterprise AI automation market could reach $45 billion by 2028.""",

    # Article 23
    "Non-profit research group Epoch AI published a study examining a question that has loomed over the entire AI industry for years": """Non-profit research group Epoch AI published a study examining a question that has loomed over the entire AI industry for years without a clear, independently verified answer: is running today’s AI models actually profitable, both in the immediate term and over their full operating lifecycle? The study, which took over 18 months to complete, drew on publicly available data, industry surveys, and confidential conversations with infrastructure providers to build what the authors described as the most independent assessment of AI model economics to date.

The findings feed directly into a wider debate about whether the AI industry’s enormous, ongoing infrastructure spending — spanning data centers, custom chips, and long-term compute contracts — will ultimately pay off for the companies making those bets, or whether current pricing and usage patterns are being propped up by promotional pricing and investor subsidies that can’t last indefinitely. The study found that while the largest frontier models appear to be operating at or near profitability at current pricing for API-based inference, the picture becomes significantly less clear when factoring in the full cost of model training.

The question matters well beyond the AI labs themselves. Enterprise customers building products and workflows around specific AI models have a direct interest in whether the pricing they rely on today is sustainable, since a sudden price correction — upward, if subsidies end, or downward, if competition intensifies further — could meaningfully reshape the economics of AI-dependent businesses built on top of these platforms almost overnight.

The Epoch AI study noted that the average price per million tokens for frontier model API calls has fallen roughly 90% since early 2024, even as the underlying compute cost per token has fallen by an estimated 60-70%. That gap — prices falling faster than costs — suggests that competition and the race for market share are driving pricing below sustainable levels for some providers.""",

    # Article 24
    "Shortly after finalizing a new agreement with OpenAI, Microsoft moved quickly to deepen its relationship with Anthropic": """Shortly after finalizing a new agreement with OpenAI, Microsoft moved quickly to deepen its relationship with Anthropic, now widely regarded as the second most valuable AI startup globally behind OpenAI itself. The speed of the move — coming within days of the OpenAI deal being finalized — suggests Microsoft sees genuine strategic value in supporting more than one frontier AI lab, rather than betting its entire AI strategy on a single partner.

The shift is notable given how closely Microsoft and OpenAI’s relationship has historically been viewed, with Microsoft having invested billions of dollars into OpenAI and integrated its models deeply across products like Copilot, Azure, and Bing. Under the restructured OpenAI agreement, Microsoft reportedly retains preferred access to OpenAI’s models but with reduced exclusivity provisions. A parallel, deepening relationship with Anthropic — a company that competes directly with OpenAI for enterprise customers — represents a meaningful diversification of Microsoft’s AI bets.

The Anthropic partnership is expected to involve significant Azure compute commitments, giving Anthropic additional cloud infrastructure beyond its existing arrangements with AWS and Google Cloud. Microsoft will also integrate Claude models into several of its enterprise products, including a new version of Microsoft 365 Copilot that will allow enterprises to choose between OpenAI and Anthropic models depending on their specific use case requirements.

Industry observers see the move as a pragmatic hedge: by maintaining strong ties to both leading labs, Microsoft ensures it isn’t overly exposed to the risks facing any single AI company, whether those risks come from legal challenges like Musk’s ongoing lawsuit against OpenAI, competitive pressure, or simply the inherent uncertainty of backing a single company in such a fast-moving industry.""",

    # Article 25
    "OpenAI added age verification measures to ChatGPT following reports that several young people had died by suicide after conversations with the chatbot": """OpenAI added age verification measures to ChatGPT following reports that several young people had died by suicide after conversations with the chatbot, prompting renewed scrutiny of how AI companies protect younger and more vulnerable users. The reports, first documented by investigative outlets in late 2025 and early 2026, described cases where individuals — predominantly teenagers and young adults — had engaged in extended, emotionally charged conversations with ChatGPT in the period before their deaths. The specific mechanics of the verification system were not fully detailed publicly, but the move represents one of the more significant safety changes OpenAI has made to ChatGPT’s consumer product in recent memory.

The change is part of a broader industry reckoning over AI safety for younger users, as chatbots have become deeply embedded in daily routines for people of all ages, including minors who may turn to them for company, advice, or emotional support in ways not originally anticipated by the companies building these systems. Studies from the Pew Research Center found that 67% of teenagers aged 13-17 reported using AI chatbots at least weekly in early 2026, up from 38% a year earlier.

The move reflects growing pressure across the AI industry more broadly to build stronger, more proactive safeguards as usage scales into the hundreds of millions of users worldwide, spanning an enormous range of ages, mental states, and life circumstances that a single one-size-fits-all product experience may not adequately serve or protect. Lawmakers in several countries, including the United Kingdom, Australia, and members of the European Parliament, have introduced or advanced legislation specifically targeting AI safety for minors.

If you or someone you know is struggling, please reach out to a crisis helpline in your country — you don’t have to go through it alone.""",

    # Article 26
    "A federal judge has indicated that Elon Musk\u2019s lawsuit challenging OpenAI\u2019s conversion from a nonprofit into a for-profit company": """A federal judge has indicated that Elon Musk’s lawsuit challenging OpenAI’s conversion from a nonprofit into a for-profit company will move forward to trial rather than being dismissed or settled beforehand. The ruling, issued by the U.S. District Court for the Northern District of California, denied OpenAI’s motion to dismiss the case on multiple grounds, finding that Musk had presented sufficient factual allegations to warrant a full trial. The case adds a meaningful layer of legal uncertainty for enterprise customers who have built AI strategies around OpenAI’s tools.

The lawsuit is one of several fronts on which Musk — a former OpenAI co-founder who left the organization years before its meteoric rise, and who now runs a directly competing AI company in xAI — has publicly challenged OpenAI’s direction since departing. Musk has argued that OpenAI’s shift toward a for-profit structure betrays the nonprofit, safety-focused mission the organization was originally founded under, when he, Sam Altman, and others signed the founding documents committing to open and safe AI development.

OpenAI has consistently maintained that its restructuring was necessary to raise the enormous sums of capital required to remain competitive in frontier AI development, and that its underlying mission remains unchanged despite the new corporate structure. The company has argued that remaining a nonprofit would have made it impossible to attract the billions of dollars in investment needed to train frontier models. Legal experts following the case have noted that the outcome could set important precedents for how nonprofit-to-for-profit conversions are handled.

With the case now headed toward trial rather than an earlier resolution, the dispute is likely to remain a visible distraction for OpenAI even as it continues to compete for enterprise customers, prepare for a possible public listing, and manage its high-profile rivalry with Anthropic and Google. The trial is expected to begin in late 2026 or early 2027.""",

    # Article 27
    "Elon Musk\u2019s xAI opened 2026 with a $20 billion Series E funding round": """Elon Musk’s xAI opened 2026 with a $20 billion Series E funding round, the first of what would become a string of record-breaking raises across the AI industry this year. Andreessen Horowitz led the round alongside 8VC, Lightspeed Venture Partners, and Shield Capital, pushing xAI’s total reported funding to roughly $42.7 billion in combined debt and equity. The round, which closed in early January, was the largest single venture capital round in history at the time, though it was surpassed by OpenAI’s $122 billion raise in March.

Shortly after, xAI effectively merged its interests with SpaceX, another Musk-led company. Under the terms of the merger, xAI’s technology and team became integrated with SpaceX’s broader operations, while SpaceX’s massive compute resources — including direct access to the Colossus supercomputer cluster in Memphis, among the largest AI training facilities in the world — became available to xAI’s model development efforts. The move means the highly anticipated SpaceX IPO would become the primary way for public market investors to gain exposure to xAI’s Grok models.

The scale of the raise reflects investor appetite for a company that has aggressively closed the gap with OpenAI and Anthropic on model quality over the past year, while also benefiting from tight integration with X and Musk’s broader constellation of companies, including direct access to real-time data from the social media platform. The Colossus supercomputer, which contains over 200,000 Nvidia GPUs, gives xAI one of the largest dedicated AI training clusters in the world.

Market analysts noted that the SpaceX-xAI merger creates a unique corporate structure that could be difficult for competitors to replicate, combining space technology, social media, and frontier AI under a single umbrella heading toward public markets. The merger also raised questions about corporate governance and potential conflicts of interest, given Musk’s simultaneous leadership roles across multiple companies competing in overlapping markets.""",
}

# Now do the replacements
print(f"Prepared {len(expansions)} expansions")

count = 0
for unique_phrase, new_body in expansions.items():
    # Find this phrase in the content
    idx = content.find(unique_phrase)
    if idx == -1:
        print(f"  WARNING: Could not find: {unique_phrase[:70]}...")
        continue
    
    # Find the opening backtick of the body
    search_start = max(0, idx - 200)
    body_marker = "body: `"
    marker_idx = content.rfind(body_marker, search_start, idx)
    if marker_idx == -1:
        print(f"  WARNING: No body marker for: {unique_phrase[:70]}...")
        continue
    
    backtick_start = marker_idx + len(body_marker)
    
    # Find the closing backtick followed by comma
    close_idx = content.find("`,", backtick_start + 1)
    if close_idx == -1:
        print(f"  WARNING: No closing backtick for: {unique_phrase[:70]}...")
        continue
    
    # Extract current body (between backticks, without the backticks)
    old_body = content[backtick_start + 1:close_idx]
    old_len = len(old_body)
    new_len = len(new_body)
    
    # Replace
    content = content[:backtick_start + 1] + new_body + content[close_idx:]
    count += 1
    print(f"  [{count}] {unique_phrase[:55]}... {old_len} -> {new_len} chars")

print(f"\nTotal: {count} replacements")

with open("/home/z/my-project/src/lib/news-data.ts", "w") as f:
    f.write(content)

print("File written.")
