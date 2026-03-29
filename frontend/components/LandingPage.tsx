"use client";

import Image from "next/image";
import { Sparkles, Brain, Cpu, MessageSquare } from "lucide-react";
import { ReactNode } from "react";

interface LandingPageProps {
  inputElement: ReactNode;
}

export default function LandingPage({ inputElement }: LandingPageProps) {
  return (
    <div className="fixed inset-0 z-[100] w-full h-full bg-white overflow-y-auto overflow-x-hidden" style={{ fontFamily: "'Inter', 'Segoe UI', system-ui, -apple-system, sans-serif" }}>
      {/* NAVBAR */}
      <nav className="fixed top-0 left-0 right-0 z-[110] bg-white/80 backdrop-blur-md border-b border-gray-100">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#1B6AC9] to-[#1558a8] flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-xl font-bold tracking-tight text-[#1a1a2e]">Synod</span>
        </div>
        
        <div className="hidden md:flex items-center gap-8 rounded-full border border-gray-200 bg-white/50 px-8 py-2.5 text-sm font-medium text-gray-600 shadow-sm">
          <a href="#" className="hover:text-blue-600 transition-colors">Product</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Solutions</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Case Studies</a>
          <a href="#" className="hover:text-blue-600 transition-colors">Pricing</a>
        </div>

        <button className="rounded-full bg-blue-500 hover:bg-blue-600 transition-colors px-6 py-2.5 text-sm font-medium text-white shadow-md">
          Try Synod
        </button>
        </div>
      </nav>

      {/* HERO SECTION */}
      <section className="relative pt-32 pb-20 w-full flex flex-col items-center">
        {/* Northern Lights blue gradient background */}
        <div className="absolute top-0 left-0 w-full h-[800px] overflow-hidden -z-10">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-50 to-white" />
          <div className="absolute top-0 left-1/4 w-[800px] h-[600px] bg-blue-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 -translate-y-1/2" />
          <div className="absolute top-0 right-1/4 w-[600px] h-[600px] bg-cyan-300 rounded-full mix-blend-multiply filter blur-[120px] opacity-20 -translate-y-1/2" />
        </div>

        <div className="flex flex-col items-center text-center max-w-4xl px-6">
          <div className="mb-6 flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-sm font-medium text-gray-600 shadow-sm">
            <span role="img" aria-label="sparkle">✨</span> The Platform works
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-[#1a1a2e] mb-6 leading-tight">
            Make better decisions <br />
            with <span className="font-serif italic text-blue-500">AI experts</span>
          </h1>
          
          <p className="max-w-2xl text-lg text-gray-500 mb-12">
            Synod is an AI advisory board built specifically for tech founders and product teams. Get instant, structured insight into any decision.
          </p>
          
          {/* Injecting the DecisionInput form recursively without reloading app */}
          <div className="w-full max-w-3xl relative z-10 bg-white rounded-3xl p-1 shadow-[0_12px_40px_-15px_rgba(27,106,201,0.3)] border border-blue-50">
            <div className="bg-gradient-to-b from-blue-50 to-white rounded-[1.35rem] p-1">
              {inputElement}
            </div>
          </div>
        </div>

        {/* LOGOS */}
        <div className="flex flex-wrap justify-center items-center gap-12 mt-20 opacity-40 grayscale select-none px-6">
           <span className="text-2xl font-black tracking-tighter text-gray-800">Zelle</span>
           <span className="text-2xl font-bold italic tracking-tight text-blue-900">venmo</span>
           <span className="text-3xl font-extrabold text-blue-800">Pay<span className="text-blue-500">Pal</span></span>
           <span className="text-3xl font-bold tracking-tight text-indigo-700">stripe</span>
           <span className="text-xl font-semibold tracking-tight text-black flex items-center gap-1">
             <span className="mb-1 text-2xl"></span> Pay
           </span>
        </div>
      </section>

      {/* SECTION 2: 3D Robot Cat Grid */}
      <section className="py-24 px-6 max-w-7xl mx-auto flex flex-col items-center text-center bg-white relative z-10">
        <h2 className="text-4xl font-bold text-[#1a1a2e] mb-16">
          Built for <span className="text-blue-500">decisions</span> that <br />actually matter
        </h2>

        <div className="relative w-full max-w-5xl flex flex-col md:flex-row items-center justify-between gap-8 h-auto p-4">
          
          <div className="w-full md:w-1/3 flex flex-col gap-6 relative z-10">
            {/* Card 1 */}
            <div className="bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow border border-gray-100" style={{ borderRadius: '20px' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-xl mb-4 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
                 <Cpu size={24} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Multi-Agent Intelligence</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Synod automatically routes your prompt to the best possible subset of AI advisors.</p>
            </div>
            {/* Card 2 */}
            <div className="bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow border border-gray-100" style={{ borderRadius: '20px' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-xl mb-4 text-white flex items-center justify-center shadow-lg shadow-cyan-500/20">
                 <Sparkles size={24} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Structured Decision Output</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Not just chat. You get highly parsed, actionable insights delivered natively.</p>
            </div>
          </div>

          {/* Center Image */}
          <div className="w-full md:w-1/3 flex justify-center relative z-0 py-12">
             <div className="absolute inset-0 bg-blue-400 opacity-20 filter blur-[100px] rounded-full mix-blend-multiply" />
             <Image src="/cat.png" width={420} height={420} alt="3D Robot Cat" className="object-contain drop-shadow-2xl hover:scale-110 transition-transform duration-700 relative z-10" />
          </div>

          <div className="w-full md:w-1/3 flex flex-col gap-6 relative z-10">
            {/* Card 3 */}
            <div className="bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow border border-gray-100" style={{ borderRadius: '20px' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-indigo-400 to-blue-600 rounded-xl mb-4 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20">
                 <Brain size={24} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Outside-In Reasoning</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Experts analyze from multiple competitive angles to spot blind spots in your ideas.</p>
            </div>
            {/* Card 4 */}
            <div className="bg-white p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] text-left hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] transition-shadow border border-gray-100" style={{ borderRadius: '20px' }}>
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-800 rounded-xl mb-4 text-white flex items-center justify-center shadow-lg shadow-blue-800/20">
                 <MessageSquare size={24} />
              </div>
              <h3 className="font-bold text-gray-900 mb-2">Context-Aware Thinking</h3>
              <p className="text-sm text-gray-500 leading-relaxed">Long-term memory integration uses previous prompts to learn your style perfectly.</p>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 3: How it Works */}
      <section className="py-24 px-6 w-full flex flex-col items-center bg-white">
        <h2 className="text-4xl font-bold tracking-tight text-[#1a1a2e] mb-4">
          How <span className="text-blue-500 font-serif italic">Synod</span> works
        </h2>
        <p className="text-gray-500 text-center max-w-lg mb-16 text-sm">
          Turn any problem into a structured decision powered by multiple AI perspectives.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
           {/* Card 1 */}
           <div className="bg-white border border-gray-100 p-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ borderRadius: '20px' }}>
             <div className="p-8 text-center h-[200px] flex flex-col justify-start">
               <h3 className="font-bold text-lg mb-3 text-[#1a1a2e]">Describe Your Decision</h3>
               <p className="text-xs text-gray-500 leading-relaxed">
                 State your problem, issue, or question. From product strategy to technical trade-offs, anything fits in a single line.
               </p>
             </div>
             <div className="h-48 w-full bg-gradient-to-br from-blue-50 via-blue-100 to-blue-300" style={{ borderRadius: '14px' }} />
           </div>
           
           {/* Card 2 */}
           <div className="bg-white border border-gray-100 p-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ borderRadius: '20px' }}>
             <div className="p-8 text-center h-[200px] flex flex-col justify-start">
               <h3 className="font-bold text-lg mb-3 text-[#1a1a2e]">Multiple AI Experts Analyze</h3>
               <p className="text-xs text-gray-500 leading-relaxed">
                 Different agents look for mistakes and bias. Each uses a unique model to ensure perspectives in parallel.
               </p>
             </div>
             <div className="h-48 w-full overflow-hidden relative" style={{ borderRadius: '14px' }}>
                <div className="absolute inset-0 bg-[#A0C4FF] opacity-80" />
                <div className="absolute inset-0 bg-gradient-to-r from-blue-400/20 to-transparent" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white/30 filter blur-3xl rounded-full" />
             </div>
           </div>

           {/* Card 3 */}
           <div className="bg-white border border-gray-100 p-2 overflow-hidden shadow-sm hover:shadow-md transition-shadow" style={{ borderRadius: '20px' }}>
             <div className="p-8 text-center h-[200px] flex flex-col justify-start">
               <h3 className="font-bold text-lg mb-3 text-[#1a1a2e]">Debate & Reasoning</h3>
               <p className="text-xs text-gray-500 leading-relaxed">
                 Agents challenge each other, agree on results, and synthesize finding specifically for you and your choices.
               </p>
             </div>
             <div className="h-48 w-full overflow-hidden relative" style={{ borderRadius: '14px' }}>
                <div className="absolute inset-0 bg-blue-500" />
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-600 to-cyan-300 opacity-60" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 filter blur-2xl rounded-full" />
             </div>
           </div>
        </div>
      </section>

      {/* SECTION 4: Pricing */}
      <section className="py-24 px-6 flex flex-col items-center">
        <h2 className="text-3xl font-bold text-[#1a1a2e] mb-8">Plans and <span className="text-blue-500">Pricing</span></h2>
        
        <div className="flex items-center gap-3 mb-12">
          <span className="text-sm font-medium">Monthly</span>
          <div className="w-10 h-5 bg-blue-500 rounded-full flex items-center p-0.5 shadow-inner">
             <div className="w-4 h-4 rounded-full bg-white ml-auto" />
          </div>
          <span className="text-sm font-medium text-gray-400">Annually</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl items-center w-full">
           {/* Starter */}
           <div className="bg-white border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow" style={{ borderRadius: '20px' }}>
             <h3 className="font-bold text-xl text-gray-900 mb-2">Starter</h3>
             <div className="flex items-end gap-1 mb-6">
               <span className="text-5xl font-black text-[#1a1a2e] tracking-tighter">$20</span>
               <span className="text-gray-400 text-sm mb-1.5 font-medium">/month</span>
             </div>
             <button className="w-full bg-blue-50 text-blue-600 font-bold py-4 transition-colors hover:bg-blue-100" style={{ borderRadius: '14px' }}>Start free trial</button>
             <ul className="space-y-4 text-sm text-gray-600 mt-10">
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} className="text-blue-500" /> Unlimited standard requests</li>
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} className="text-blue-500" /> Access up to 4 agents</li>
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} className="text-blue-500" /> Daily synthesis quotas</li>
             </ul>
           </div>

           {/* Growth */}
           <div className="bg-gradient-to-br from-blue-500 to-blue-700 p-10 text-white relative shadow-2xl scale-105 z-20" style={{ borderRadius: '20px' }}>
             <div className="absolute top-6 right-6 bg-white/20 px-4 py-1.5 rounded-full text-xs font-bold backdrop-blur-md border border-white/20 uppercase tracking-widest">Most Popular</div>
             <h3 className="font-bold text-xl mb-2">Growth</h3>
             <div className="flex items-end gap-1 mb-6">
               <span className="text-5xl font-black tracking-tighter">$99</span>
               <span className="text-blue-100 text-sm mb-1.5 font-medium">/month</span>
             </div>
             <button className="w-full bg-white text-blue-600 font-bold py-4 shadow-xl hover:scale-105 transition-transform" style={{ borderRadius: '14px' }}>Start free trial</button>
             <ul className="space-y-4 text-sm text-blue-50 mt-10">
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} /> Higher request limits</li>
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} /> Web-search enabled</li>
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} /> Data import & parsing</li>
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} /> Custom instructions</li>
             </ul>
           </div>

           {/* Enterprise */}
           <div className="bg-white border border-gray-100 p-8 shadow-sm hover:shadow-md transition-shadow" style={{ borderRadius: '20px' }}>
             <h3 className="font-bold text-xl text-gray-900 mb-2">Enterprise</h3>
             <div className="flex items-end gap-1 mb-6">
               <span className="text-5xl font-black text-[#1a1a2e] tracking-tighter">$299</span>
               <span className="text-gray-400 text-sm mb-1.5 font-medium">/month</span>
             </div>
             <button className="w-full bg-blue-50 text-blue-600 font-bold py-4 transition-colors hover:bg-blue-100" style={{ borderRadius: '14px' }}>Start free trial</button>
             <ul className="space-y-4 text-sm text-gray-600 mt-10">
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} className="text-blue-500" /> Unlimited everything</li>
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} className="text-blue-500" /> Custom AI experts</li>
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} className="text-blue-500" /> Team collaboration</li>
               <li className="flex items-center gap-3 font-medium"><Sparkles size={18} className="text-blue-500" /> SLA priority support</li>
             </ul>
           </div>
        </div>
      </section>

      {/* SECTION 5: FAQ */}
      <section className="py-24 px-6 max-w-3xl mx-auto flex flex-col items-center w-full">
        <h2 className="text-3xl font-bold text-[#1a1a2e] mb-12">Frequently Asked <span className="text-blue-500">Questions</span></h2>
        
        <div className="w-full space-y-4">
          {[
            { id: '01', title: 'What is Synod, exactly?', desc: 'Synod is an advanced AI multi-agent platform that lets multiple specialized AI models debate.' },
            { id: '02', title: 'How is this different from ChatGPT?' },
            { id: '03', title: 'What kind of decisions can I use Synod for?' },
            { id: '04', title: 'How accurate are the recommendations?' },
            { id: '05', title: 'Can I customize the AI experts?' },
          ].map((faq) => (
             <div key={faq.id} className="border-b border-gray-200 pb-4">
               <button className="w-full flex items-center justify-between text-left py-4">
                  <div className="flex items-center gap-6">
                     <span className="text-2xl text-gray-300 font-light">{faq.id}</span>
                     <span className="font-medium text-gray-900">{faq.title}</span>
                  </div>
                  <ChevronRightIcon />
               </button>
               {faq.desc && <p className="text-gray-500 text-sm ml-12 pr-12 mt-2">{faq.desc}</p>}
             </div>
          ))}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative mt-20 pt-40 overflow-hidden w-full flex flex-col items-center bg-transparent">
        <div className="absolute bottom-0 w-[150%] h-[500px] md:h-[600px] bg-gradient-to-t from-blue-600 to-blue-400 rounded-t-[100%] z-0" style={{ left: '-25%' }} />
        
        <div className="relative z-10 flex flex-col items-center pt-24 pb-12 w-full max-w-7xl px-6">
           <div className="flex items-center gap-3 mb-8">
             <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center p-2 shadow-lg">
                <div className="grid grid-cols-2 gap-1 w-full h-full p-0.5">
                   <div className="w-full h-full bg-blue-500 rounded-full" />
                   <div className="w-full h-full bg-blue-500 rounded-full" />
                   <div className="w-full h-full bg-blue-500 rounded-full" />
                   <div className="w-full h-full bg-blue-500 rounded-full" />
                </div>
             </div>
             <span className="text-4xl font-bold text-white tracking-tight">Synod</span>
           </div>

           <p className="text-blue-100 text-center text-xs max-w-md mx-auto mb-12">
             Synod treats multiple agents via heuristic chat workflows and generates structured outputs.
           </p>

           <div className="flex flex-col md:flex-row w-full justify-between items-center text-blue-100 text-sm mt-12 md:mt-32">
              <div className="flex gap-4">
                 <a href="#" className="hover:text-white transition-colors">Socials</a>
              </div>
              <div className="w-full md:w-64 border-b border-white/30 flex justify-between items-center pb-2 px-2 mt-8 md:mt-0">
                 <span className="text-white/60 text-xs">Your email</span>
                 <span>→</span>
              </div>
              <div className="flex flex-col items-center md:items-end mt-8 md:mt-0">
                 <span className="font-medium">Contact</span>
                 <a href="mailto:hello@synod.ai" className="text-white font-medium hover:underline">hello@synod.ai</a>
              </div>
           </div>
        </div>
      </footer>
    </div>
  );
}

function ChevronRightIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-gray-400 h-5 w-5"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}
