import { MessageSquare, Code, BookOpen, Lightbulb, Zap, Target } from "lucide-react";
import { cn } from "@/lib/utils";

interface WelcomeScreenProps {
  onExampleClick: (question: string) => void;
  mode: "simple" | "advanced";
}

interface Example {
  icon: any;
  title: string;
  description: string;
  question: string;
}

const simpleExamples: Example[] = [
  {
    icon: MessageSquare,
    title: "日常对话",
    description: "轻松聊天，快速问答",
    question: "今天天气怎么样？",
  },
  {
    icon: Code,
    title: "代码帮助",
    description: "编程问题，快速解答",
    question: "如何用 Python 读取文件？",
  },
  {
    icon: BookOpen,
    title: "学习辅助",
    description: "解释概念，帮助理解",
    question: "什么是机器学习？",
  },
];

const advancedExamples: Example[] = [
  {
    icon: Zap,
    title: "复杂编程",
    description: "架构设计，性能优化",
    question: "如何设计一个高并发的分布式系统？",
  },
  {
    icon: Target,
    title: "深度分析",
    description: "问题分析，方案对比",
    question: "比较 React 和 Vue 的优缺点，在什么场景下选择哪个？",
  },
  {
    icon: Lightbulb,
    title: "创新思路",
    description: "头脑风暴，创意激发",
    question: "如何用 AI 改进现有的工作流程？",
  },
];

export function WelcomeScreen({ onExampleClick, mode }: WelcomeScreenProps) {
  const examples = mode === "simple" ? simpleExamples : advancedExamples;

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 py-12 animate-in fade-in duration-500">
      {/* Logo 和标题 */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 mb-4">
          <MessageSquare className="w-8 h-8 text-primary" />
        </div>
        <h1 className="text-3xl font-bold mb-2">
          {mode === "simple" ? "简单模式" : "高级模式"}
        </h1>
        <p className="text-muted-foreground text-lg">
          {mode === "simple" 
            ? "轻松对话，快速获得答案" 
            : "深入探讨，解决复杂问题"}
        </p>
      </div>

      {/* 示例问题卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl w-full">
        {examples.map((example, index) => {
          const Icon = example.icon;
          return (
            <button
              key={index}
              onClick={() => onExampleClick(example.question)}
              className={cn(
                "group flex flex-col items-start p-6 rounded-xl border border-border",
                "bg-card hover:bg-accent hover:border-primary/50",
                "transition-all duration-200 text-left",
                "hover:shadow-md hover:-translate-y-1"
              )}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-primary/10 group-hover:bg-primary/20 transition-colors">
                  <Icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold">{example.title}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-2">
                {example.description}
              </p>
              <p className="text-sm font-medium text-foreground line-clamp-2">
                "{example.question}"
              </p>
            </button>
          );
        })}
      </div>

      {/* 提示文字 */}
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>💡 提示：你可以随时在简单模式和高级模式之间切换</p>
      </div>
    </div>
  );
}
