import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CheckCircle, ArrowRight, Building, Shield, Clock, CheckIcon, Lock, Database } from "lucide-react"
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
                Collaborative Text Editing with Coherence
              </h1>
              <p className="text-muted-foreground md:text-xl mb-8">
                A powerful text editor built for seamless collaboration and organized document management.
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
                  <div className="absolute left-0 right-0 mx-auto text-center text-xs text-muted-foreground font-medium" style={{ width: 'fit-content' }}>Coherence Editor</div>
                </div>
                
                {/* Demo Image */}
                <div className="flex items-center justify-center p-0">
                  <img 
                    src="/editor-demo.png" 
                    alt="Coherence Editor Demo" 
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
                <p className="text-muted-foreground">Powerful text editing with collaborative capabilities</p>
              </div>
              
              {/* Collaborative Editing */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-2">Collaborative Editing</h3>
                  <p className="text-muted-foreground mb-4">
                    Work together in real-time with teammates across the globe. Changes sync instantly,
                    enabling seamless collaboration without conflicts or delays.
                  </p>
                </div>
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                    <div className="flex items-center">
                      <Building className="h-4 w-4 text-blue-600 mr-2" />
                      <span className="font-medium text-foreground">Team Collaboration</span>
                    </div>
                    <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center dark:bg-green-950 dark:text-green-300">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      <span>Active</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <div className={`flex justify-between items-center p-4 ${isLoaded ? "animate-pulse bg-gradient-to-r from-background to-blue-500/5 dark:from-background dark:to-blue-400/10" : ""}`}>
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-muted mr-3 flex items-center justify-center text-xs text-muted-foreground">AS</div>
                        <div>
                          <div className="font-medium">Asian Smith</div>
                          <div className="text-xs text-muted-foreground">Editing now</div>
                        </div>
                      </div>
                      <div className="text-green-600 flex items-center">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-1"></span>
                        <span>Online</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-muted mr-3 flex items-center justify-center text-xs text-muted-foreground">JD</div>
                        <div>
                          <div className="font-medium">John Doe</div>
                          <div className="text-xs text-muted-foreground">Viewing</div>
                        </div>
                      </div>
                      <div className="text-green-600 flex items-center">
                        <span className="inline-block w-2 h-2 rounded-full bg-green-600 mr-1"></span>
                        <span>Online</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center p-4">
                      <div className="flex items-center">
                        <div className="w-8 h-8 rounded-full bg-muted mr-3 flex items-center justify-center text-xs text-muted-foreground">MS</div>
                        <div>
                          <div className="font-medium">Maria Smith</div>
                          <div className="text-xs text-muted-foreground">Last edited 5m ago</div>
                        </div>
                      </div>
                      <div className="text-gray-500 flex items-center">
                        <span className="inline-block w-2 h-2 rounded-full bg-gray-500 mr-1"></span>
                        <span>Offline</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Version History */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-2">Version History</h3>
                  <p className="text-muted-foreground mb-4">
                    Never lose your work with comprehensive version history. Easily roll back to previous
                    versions or compare changes to see what's been modified.
                  </p>
                </div>
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 text-indigo-600 mr-2" />
                      <span className="font-medium text-foreground">Document History</span>
                    </div>
                    <div className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full flex items-center dark:bg-blue-950 dark:text-blue-300">
                      <span>25 versions</span>
                    </div>
                  </div>
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">
                    <div className={`flex justify-between items-center p-4 ${isLoaded ? "animate-pulse bg-gradient-to-r from-background to-blue-500/5 dark:from-background dark:to-blue-400/10" : ""}`}>
                      <div>
                        <div className="font-medium">Current Version</div>
                        <div className="text-xs text-muted-foreground">Just now</div>
                      </div>
                      <Button variant="outline" size="sm">Restore</Button>
                    </div>
                    <div className="flex justify-between items-center p-4">
                      <div>
                        <div className="font-medium">Version 24</div>
                        <div className="text-xs text-muted-foreground">Today, 2:15 PM</div>
                      </div>
                      <Button variant="outline" size="sm">Restore</Button>
                    </div>
                    <div className="flex justify-between items-center p-4">
                      <div>
                        <div className="font-medium">Version 23</div>
                        <div className="text-xs text-muted-foreground">Today, 1:45 PM</div>
                      </div>
                      <Button variant="outline" size="sm">Restore</Button>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Rich Text Features */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
                <div className="flex flex-col justify-center">
                  <h3 className="text-xl font-bold mb-2">Rich Text Editing</h3>
                  <p className="text-muted-foreground mb-4">
                    Express your ideas with powerful formatting tools. Our editor supports rich text
                    formatting, embedded media, and custom elements for enhanced productivity.
                  </p>
                </div>
                <div className="bg-card rounded-lg border border-border shadow-sm overflow-hidden transition-all duration-300 hover:shadow-md">
                  <div className="p-4 border-b border-border flex justify-between items-center">
                    <div className="flex items-center">
                      <span className="font-medium text-foreground">Text Formatting</span>
                    </div>
                  </div>
                  <div className="p-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Headings (H1-H6)</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Bold & Italic</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Bulleted Lists</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Numbered Lists</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Code Blocks</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Image Embedding</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Tables</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Block Quotes</span>
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
              <h2 className="text-3xl font-bold leading-[1.1] sm:text-3xl md:text-6xl">Why Coherence Matters</h2>
              <p className="max-w-[85%] leading-normal text-muted-foreground sm:text-lg sm:leading-7">
                In today's fast-paced work environment, seamless collaboration and organized document 
                management are essential for teams to stay productive and aligned.
              </p>
            </div>
            
            <div className={`mx-auto grid justify-center gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 lg:gap-8 xl:gap-10 mt-12 ${isLoaded ? "opacity-100 transition-opacity duration-1000 delay-300" : "opacity-0"}`}>
              <Card className={`h-full transition-all duration-200 hover:shadow-lg border-border ${isLoaded ? "opacity-100 translate-y-0 transition-all duration-700 delay-100" : "opacity-0 translate-y-10"}`}>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Lock className="h-5 w-5 text-blue-600" />
                  <CardTitle>Secure Sharing</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Share documents with the right people with fine-grained access controls. Set edit, comment,
                    or view-only permissions for each collaborator.
                  </p>
                </CardContent>
              </Card>
              
              <Card className={`h-full transition-all duration-200 hover:shadow-lg border-border ${isLoaded ? "opacity-100 translate-y-0 transition-all duration-700 delay-200" : "opacity-0 translate-y-10"}`}>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Shield className="h-5 w-5 text-blue-600" />
                  <CardTitle>Data Protection</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Your documents are automatically saved and protected. With regular backups and
                    version history, your content is always secure and recoverable.
                  </p>
                </CardContent>
              </Card>
              
              <Card className={`h-full transition-all duration-200 hover:shadow-lg border-border ${isLoaded ? "opacity-100 translate-y-0 transition-all duration-700 delay-300" : "opacity-0 translate-y-10"}`}>
                <CardHeader className="flex flex-row items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <CardTitle>Organized Workspace</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">
                    Keep your documents organized with folders, tags, and search capabilities. Find what you
                    need quickly without wasting time searching through files.
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