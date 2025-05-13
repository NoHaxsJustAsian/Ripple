import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, ArrowRight, Building, Shield, Clock, CheckIcon, Lock, Database, MessageSquare, Sparkles, Bot } from "lucide-react"
import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import { 
  HoverCard, 
  HoverCardTrigger, 
  HoverCardContent 
} from "@/components/ui/hover-card"
import { 
  Avatar, 
  AvatarImage, 
  AvatarFallback 
} from "@/components/ui/avatar"
import { Header } from "@/components/Header"

export default function Hero() {
  const [isLoaded, setIsLoaded] = useState(false)
  
  useEffect(() => {
    // Allow animations to start after component mounts
    setIsLoaded(true)
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <section className="w-full py-12 md:py-24 lg:py-32 xl:py-40">
          <div className="container px-4 md:px-6">
            <div className="max-w-3xl mx-auto text-center mb-16">
              <h1 className="text-3xl font-bold tracking-tighter sm:text-5xl xl:text-6xl/none mb-6">
                AI-Powered Text Editing with Ripple
              </h1>
              <p className="text-muted-foreground md:text-xl mb-8">
                An intelligent editor with AI assistance for seamless writing, collaboration, and document enhancement.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link to="/editor">
                  <Button size="lg">
                    Get Started
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
            <div className="max-w-4xl mx-auto mb-20">
              <div className="bg-card rounded-lg shadow-xl overflow-hidden border border-border">
                {/* Window title bar */}
                <div className="h-8 bg-muted border-b border-border flex items-center px-4">
                  <div className="flex space-x-2 ml-1">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  </div>
                  <div className="absolute left-0 right-0 mx-auto text-center text-xs text-muted-foreground font-medium" style={{ width: 'fit-content' }}>Ripple Editor</div>
                </div>
                
                {/* Demo Image */}
                <div className="flex items-center justify-center p-0">
                  <img 
                    src="/editor-demo.png" 
                    alt="Ripple Editor Demo" 
                    className="w-full h-auto"
                  />
                </div>
              </div>
            </div>
            
            {/* Features section styled as a two-column layout */}
            <div className="max-w-5xl mx-auto">
              <div className="flex items-center gap-3 mb-8 relative">
                <div className="flex items-center text-blue-600">
                  <CheckCircle className="h-5 w-5 mr-2" />
                  <h2 className="text-xl font-bold">KEY FEATURES</h2>
                </div>
                <p className="text-muted-foreground">AI-powered text editing with smart suggestions</p>
              </div>
              
              {/* AI Chat Bar */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-2">AI Chat Bar</h3>
                  <p className="text-muted-foreground mb-4">
                    Get instant assistance from our powerful AI assistant. Ask questions, request revisions,
                    generate content, and more with the convenient side panel chat interface.
                  </p>
                </div>
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                    <div className="flex items-center">
                      <MessageSquare className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="font-medium text-foreground">AI Assistant</span>
                    </div>
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center dark:bg-green-950 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span>Active</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <div className="flex p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-muted mr-3 flex items-center justify-center text-xs text-muted-foreground">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">AI Assistant</div>
                          <div className="text-xs text-muted-foreground">How can I help with your document?</div>
                        </div>
                      </div>
                    </div>
                    <div className="flex justify-end p-4">
                      <div className="flex items-center">
                        <div>
                          <div className="font-medium text-right">You</div>
                          <div className="text-xs text-muted-foreground text-right">Can you suggest a better introduction?</div>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900 ml-3 flex items-center justify-center text-xs text-blue-600 dark:text-blue-300">
                          <span>You</span>
                        </div>
                      </div>
                    </div>
                    <div className={`flex p-4 ${isLoaded ? "animate-pulse bg-gradient-to-r from-background to-blue-500/5 dark:from-background dark:to-blue-400/10" : ""}`}>
                      <div className="flex items-start">
                        <div className="w-8 h-8 rounded-full bg-muted mr-3 flex items-center justify-center text-xs text-muted-foreground flex-shrink-0">
                          <Bot className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium">AI Assistant</div>
                          <div className="text-xs text-muted-foreground">Here's a more engaging introduction: "In today's fast-paced digital environment, standing out requires content that captivates from the first sentence..."</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Inline AI Chat */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-2">Inline AI Chat</h3>
                  <p className="text-muted-foreground mb-4">
                    Interact with AI directly within your document. Highlight text and get contextual 
                    suggestions, rephrasing options, or AI-powered edits without switching contexts.
                  </p>
                </div>
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                    <div className="flex items-center">
                      <Bot className="h-4 w-4 text-indigo-600 mr-2" />
                      <span className="font-medium text-foreground">Inline Assistant</span>
                    </div>
                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center dark:bg-blue-950 dark:text-blue-300">
                      <span>Context-aware</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <div className={`flex justify-between items-center p-4 ${isLoaded ? "animate-pulse bg-gradient-to-r from-background to-blue-500/5 dark:from-background dark:to-blue-400/10" : ""}`}>
                      <div>
                        <div className="font-medium">Selected Text</div>
                        <div className="text-xs text-muted-foreground">This paragraph needs improvement for clarity.</div>
                      </div>
                      <Button variant="outline" size="sm">Ask AI</Button>
                    </div>
                    <div className="p-4">
                      <div className="text-sm font-medium mb-1">AI Suggestions:</div>
                      <div className="text-xs text-muted-foreground mb-2">
                        Try: "This paragraph requires revision to enhance clarity and readability for the audience."
                      </div>
                      <div className="flex gap-2">
                        <Button variant="outline" size="sm">Apply</Button>
                        <Button variant="outline" size="sm">Regenerate</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Automatic AI Suggestions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-2">Automatic AI Suggestions</h3>
                  <p className="text-muted-foreground mb-4">
                    Get real-time suggestions to improve your writing. Our AI provides instant feedback on
                    grammar, cohesion, coherence, flow, and more as you type.
                  </p>
                </div>
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                    <div className="flex items-center">
                      <Sparkles className="h-4 w-4 text-amber-600 mr-2" />
                      <span className="font-medium text-foreground">Writing Enhancements</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Grammar Correction</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Cohesion Improvement</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Coherence Check</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Flow Enhancement</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Style Suggestions</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Clarity Improvements</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Tone Adjustment</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Conciseness</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="w-full py-12 md:py-24 lg:py-32 bg-muted dark:bg-black/60">
          <div className="container px-4 md:px-6">
            <div className={`mx-auto flex max-w-[58rem] flex-col items-center justify-center gap-4 text-center ${isLoaded ? "opacity-100 translate-y-0 transition-all duration-700 ease-out" : "opacity-0 translate-y-10"}`}>
              <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-6xl">Why Ripple Matters</h2>
              <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                In today's AI-driven world, writing better content faster gives you a competitive advantage.
                Ripple combines powerful editing tools with artificial intelligence to transform your workflow.
              </p>
            </div>
            
            <div className={`mx-auto grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 lg:gap-8 xl:gap-10 mt-12 ${isLoaded ? "opacity-100 transition-opacity duration-1000 delay-300" : "opacity-0"}`}>
              <Card className={`h-full transition-all duration-200 hover:shadow-lg border-border ${isLoaded ? "opacity-100 translate-y-0 transition-all duration-700 delay-100" : "opacity-0 translate-y-10"}`}>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  <CardTitle>AI-Powered Insights</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Get intelligent suggestions to improve your writing automatically. Our AI analyzes your text
                    to help you craft more compelling, error-free content.
                  </p>
                </CardContent>
              </Card>
              
              <Card className={`h-full transition-all duration-200 hover:shadow-lg border-border ${isLoaded ? "opacity-100 translate-y-0 transition-all duration-700 delay-200" : "opacity-0 translate-y-10"}`}>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <CardTitle>Contextual Assistance</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Ask questions and get help right where you need it. Our inline AI chat understands your 
                    document's context to provide relevant suggestions.
                  </p>
                </CardContent>
              </Card>
              
              <Card className={`h-full transition-all duration-200 hover:shadow-lg border-border ${isLoaded ? "opacity-100 translate-y-0 transition-all duration-700 delay-300" : "opacity-0 translate-y-10"}`}>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <CardTitle>Seamless Collaboration</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Collaborate with both humans and AI. Share your work, get feedback, and implement 
                    suggestions for better results in less time.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
      </main>
      <footer className="border-t py-6 md:py-0">
        <div className="container flex flex-col items-center justify-between gap-4 md:h-24 md:flex-row">
          <p className="text-xs text-muted-foreground leading-loose md:text-left">
            Built by{" "}
            <HoverCard openDelay={100} closeDelay={100}>
              <HoverCardTrigger asChild>
                <a
                  href="https://github.com/nohaxsjustasian"
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium underline underline-offset-4"
                >
                  @nohaxsjustasian
                </a>
              </HoverCardTrigger>
              <HoverCardContent className="w-80">
                <div className="flex justify-between space-x-4">
                  <Avatar>
                    <AvatarImage src="https://github.com/nohaxsjustasian.png" />
                    <AvatarFallback>NA</AvatarFallback>
                  </Avatar>
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold">@nohaxsjustasian</h4>
                    <p className="text-sm">
                      NEU '25 | Searching for new grad SWE positions.
                    </p>
                    <div className="flex items-center pt-2">
                      <CheckIcon className="mr-2 h-4 w-4 opacity-70" />{" "}
                      <span className="text-xs text-muted-foreground">
                        Joined December 2021
                      </span>
                    </div>
                  </div>
                </div>
              </HoverCardContent>
            </HoverCard>
          </p>
        </div>
      </footer>
    </div>
  )
} 