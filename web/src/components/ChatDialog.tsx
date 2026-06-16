import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { WelcomeScreen } from "./WelcomeScreen";
import { ChatBubble } from "./ChatBubble";
import { ChatInput } from "./ChatInput";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatDialogProps {
  sessionId?: string | null;
  className?: string;
}

export function ChatDialog({ sessionId: initialSessionId, className }: ChatDialogProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(initialSessionId || null);
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [streamingContent, setStreamingContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 滚动到底部
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent]);

  // 加载历史消息
  useEffect(() => {
    if (sessionId) {
      loadMessages(sessionId);
    }
  }, [sessionId]);

  const loadMessages = async (sid: string) => {
    try {
      const response = await fetch(`/api/chat/sessions/${encodeURIComponent(sid)}/messages`, {
        headers: {
          "X-Hermes-Session-Token": window.__HERMES_SESSION_TOKEN__ || "",
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      const msgs: Message[] = data.messages.map((m: any) => ({
        id: m.id?.toString() || Math.random().toString(),
        role: m.role as "user" | "assistant",
        content: m.content || "",
        timestamp: m.timestamp || Date.now(),
      }));
      setMessages(msgs);
    } catch (error) {
      console.error("加载消息失败:", error);
    }
  };

  // 发送消息
  const handleSendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    // 添加用户消息到列表
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);
    setStreamingContent("");

    try {
      // 使用流式 API
      const response = await fetch("/api/chat/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Hermes-Session-Token": window.__HERMES_SESSION_TOKEN__ || "",
        },
        body: JSON.stringify({
          session_id: sessionId,
          message: content,
          mode,
          stream: true,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No reader available");
      }

      const decoder = new TextDecoder();
      let fullContent = "";
      let currentSessionId = sessionId;
      // SSE events may be split across read() chunks; buffer partial lines
      // and only parse once a full "\n" terminator is present.
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last (possibly partial) line in the buffer.
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);

            if (data === "[DONE]") {
              continue;
            }

            try {
              const parsed = JSON.parse(data);

              if (parsed.type === "session_id") {
                currentSessionId = parsed.session_id;
                if (!sessionId) {
                  setSessionId(currentSessionId);
                }
              } else if (parsed.type === "delta") {
                fullContent += parsed.content;
                setStreamingContent(fullContent);
              } else if (parsed.type === "complete") {
                fullContent = parsed.content;
                setStreamingContent("");

                // 添加助手消息到列表
                const assistantMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  role: "assistant",
                  content: fullContent,
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, assistantMessage]);
              } else if (parsed.type === "error") {
                console.error("Stream error:", parsed.content);
                setStreamingContent("");

                // 添加错误消息
                const errorMessage: Message = {
                  id: (Date.now() + 1).toString(),
                  role: "assistant",
                  content: `抱歉，发生了错误：${parsed.content}`,
                  timestamp: Date.now(),
                };
                setMessages((prev) => [...prev, errorMessage]);
              }
            } catch (e) {
              console.error("Parse error:", e);
            }
          }
        }
      }
    } catch (error) {
      console.error("发送消息失败:", error);
      // 添加错误消息
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "抱歉，发生了错误。请重试。",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setStreamingContent("");
    }
  };

  // 处理示例问题点击
  const handleExampleClick = (question: string) => {
    handleSendMessage(question);
  };

  // 新建对话
  const handleNewChat = () => {
    setSessionId(null);
    setMessages([]);
    setStreamingContent("");
  };

  return (
    <div className={cn("flex flex-col h-full", className)}>
      {/* 模式切换和新建对话按钮 */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex gap-2">
          <button
            onClick={() => setMode("simple")}
            className={cn(
              "px-3 py-1 rounded text-sm transition-colors",
              mode === "simple"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            简单模式
          </button>
          <button
            onClick={() => setMode("advanced")}
            className={cn(
              "px-3 py-1 rounded text-sm transition-colors",
              mode === "advanced"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            )}
          >
            高级模式
          </button>
        </div>
        <button
          onClick={handleNewChat}
          className="px-3 py-1 rounded text-sm bg-secondary text-secondary-foreground hover:bg-secondary/80 transition-colors"
        >
          新建对话
        </button>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !streamingContent ? (
          <WelcomeScreen onExampleClick={handleExampleClick} mode={mode} />
        ) : (
          <>
            {messages.map((msg) => (
              <ChatBubble key={msg.id} message={msg} />
            ))}
            {streamingContent && (
              <ChatBubble
                message={{
                  id: "streaming",
                  role: "assistant",
                  content: streamingContent,
                  timestamp: Date.now(),
                }}
                isStreaming
              />
            )}
            {isLoading && !streamingContent && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="animate-pulse">思考中...</div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* 输入框 */}
      <ChatInput onSend={handleSendMessage} disabled={isLoading} />
    </div>
  );
}
