import { useState, useRef, useEffect } from "react";
import { 
  useListConversations, 
  useListMessages, 
  useCreateConversation,
  getListConversationsQueryKey,
  getListMessagesQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Send, Bot, User, Plus, Terminal } from "lucide-react";
import { format } from "date-fns";

export default function Chat() {
  const queryClient = useQueryClient();
  const { data: conversations, isLoading: loadingConvos } = useListConversations();
  const createConversationMutation = useCreateConversation();

  const [activeConvoId, setActiveConvoId] = useState<number | null>(null);
  const [inputMessage, setInputMessage] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamedText, setStreamedText] = useState("");
  
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-select first conversation if available
  useEffect(() => {
    if (conversations && conversations.length > 0 && !activeConvoId) {
      setActiveConvoId(conversations[0].id);
    }
  }, [conversations, activeConvoId]);

  const { data: historyMessages, isLoading: loadingMessages } = useListMessages(activeConvoId || 0, {
    query: {
      enabled: !!activeConvoId,
      queryKey: activeConvoId ? getListMessagesQueryKey(activeConvoId) : ['messages', 0]
    }
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [historyMessages, streamedText]);

  const handleNewConversation = () => {
    createConversationMutation.mutate(
      { data: { title: `Investigation ${format(new Date(), 'MMdd-HHmm')}` } },
      {
        onSuccess: (newConvo) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setActiveConvoId(newConvo.id);
        }
      }
    );
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || !activeConvoId || isStreaming) return;

    const messageToSend = inputMessage;
    setInputMessage("");
    setStreamedText("");
    setIsStreaming(true);

    // Optimistically add user message to cache
    const queryKey = getListMessagesQueryKey(activeConvoId);
    queryClient.setQueryData(queryKey, (old: any) => {
      const msgs = old || [];
      return [...msgs, { 
        id: Date.now(), 
        conversationId: activeConvoId, 
        role: "user", 
        content: messageToSend,
        createdAt: new Date().toISOString()
      }];
    });

    try {
      const res = await fetch(`/api/chat/conversations/${activeConvoId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: messageToSend })
      });
      
      if (!res.body) throw new Error("No response body");
      
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const text = decoder.decode(value);
        const lines = text.split("\n");
        
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done) break;
              if (data.content) {
                setStreamedText(prev => prev + data.content);
              }
            } catch (e) {
              // ignore parse errors for incomplete chunks
            }
          }
        }
      }
    } catch (error) {
      console.error("Chat error:", error);
    } finally {
      setIsStreaming(false);
      // Invalidate to get the final persisted messages from DB
      queryClient.invalidateQueries({ queryKey });
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6">
      {/* Sidebar - Conversation List */}
      <Card className="w-1/3 flex flex-col h-full hidden md:flex">
        <CardHeader className="pb-3 border-b flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Investigations</CardTitle>
          <Button variant="ghost" size="icon" onClick={handleNewConversation} disabled={createConversationMutation.isPending}>
            <Plus className="w-4 h-4" />
          </Button>
        </CardHeader>
        <CardContent className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            {loadingConvos ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : conversations?.map(convo => (
              <div 
                key={convo.id}
                onClick={() => setActiveConvoId(convo.id)}
                className={`p-3 border-b cursor-pointer transition-colors hover:bg-muted/50 ${activeConvoId === convo.id ? 'bg-primary/10 border-l-2 border-l-primary' : ''}`}
              >
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{convo.title}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 font-mono pl-6">
                  {format(new Date(convo.createdAt), 'yyyy-MM-dd HH:mm')}
                </div>
              </div>
            ))}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Main Chat Area */}
      <Card className="flex-1 flex flex-col h-full border-primary/20">
        <CardHeader className="py-3 border-b bg-muted/10">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">AVIS AI Assistant</CardTitle>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-hidden p-0 relative bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-background to-card">
          <div 
            ref={scrollRef}
            className="h-full overflow-y-auto p-4 space-y-6"
          >
            {loadingMessages ? (
              <div className="space-y-4">
                <Skeleton className="h-16 w-2/3 ml-auto" />
                <Skeleton className="h-24 w-2/3" />
              </div>
            ) : historyMessages?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <Bot className="w-12 h-12 mb-4 opacity-20" />
                <p>Start a conversation with the AI analyst.</p>
                <p className="text-xs">Ask about specific events, request summaries, or query camera feeds.</p>
              </div>
            ) : (
              <>
                {historyMessages?.map((msg) => (
                  <div 
                    key={msg.id} 
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`flex gap-3 max-w-[80%] ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                      <div className={`w-8 h-8 rounded border flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-secondary border-border' : 'bg-primary/20 border-primary/50 text-primary'}`}>
                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                      </div>
                      <div className={`p-3 rounded-lg text-sm whitespace-pre-wrap ${
                        msg.role === 'user' 
                          ? 'bg-secondary text-secondary-foreground' 
                          : 'bg-card border border-border text-card-foreground shadow-sm font-mono'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  </div>
                ))}
                
                {/* Streaming Message */}
                {isStreaming && streamedText && (
                  <div className="flex justify-start">
                    <div className="flex gap-3 max-w-[80%]">
                      <div className="w-8 h-8 rounded border bg-primary/20 border-primary/50 text-primary flex items-center justify-center shrink-0">
                        <Bot className="w-4 h-4" />
                      </div>
                      <div className="p-3 rounded-lg text-sm whitespace-pre-wrap bg-card border border-primary/30 text-card-foreground shadow-sm font-mono relative">
                        {streamedText}
                        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1 align-middle"></span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>

        <div className="p-4 border-t bg-card">
          <form onSubmit={handleSendMessage} className="flex gap-2">
            <Input 
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Query the investigation database..." 
              className="flex-1 bg-background font-mono text-sm"
              disabled={!activeConvoId || isStreaming}
            />
            <Button type="submit" disabled={!activeConvoId || isStreaming || !inputMessage.trim()}>
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
