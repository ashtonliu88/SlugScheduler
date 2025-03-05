import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import ChatInterface from "@/components/chat-interface"
import CalendarView from "@/components/calendar-view"

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-[#003c6c] text-white p-4 shadow-md">
        <div className="container mx-auto flex items-center gap-2">
          <h1 className="text-xl font-bold">UCSC Course Recommendation System</h1>
        </div>
      </header>

      <main className="container mx-auto py-6 px-4">
        <Tabs defaultValue="chat" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="chat">Chat Assistant</TabsTrigger>
            <TabsTrigger value="calendar">My Schedule</TabsTrigger>
          </TabsList>

          <TabsContent value="chat" className="p-4 bg-white rounded-lg shadow">
            <ChatInterface />
          </TabsContent>

          <TabsContent value="calendar" className="p-4 bg-white rounded-lg shadow">
            <CalendarView />
          </TabsContent>
        </Tabs>
      </main>

      <footer className="bg-[#003c6c] text-white p-4 mt-8">
        <div className="container mx-auto text-center">
          <p>© {new Date().getFullYear()} UCSC Course Recommendation System</p>
        </div>
      </footer>
    </div>
  )
}

