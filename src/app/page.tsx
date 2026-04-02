"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Plus, Trash2, Filter, ChevronDown, Tag, Loader2, Check, X, Pencil, Moon, Sun } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

// --- Google Sheets API URL ---
const API_URL = process.env.NEXT_PUBLIC_GOOGLE_SHEET_URL;

type Category = "할 일" | "아이디어" | "기타";

interface Note {
  id: number; // timestamp로 활용
  timestamp: string | number;
  datetime: string;
  category: Category;
  content: string;
  color: string;
  rotation: number;
}

const COLORS = [
  "bg-[#fff9c4]", "bg-[#f8bbd0]", "bg-[#bbdefb]", "bg-[#c8e6c9]", "bg-[#ffe0b2]", "bg-[#e1bee7]"
];

const CATEGORIES: Category[] = ["할 일", "아이디어", "기타"];

export default function Home() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [notes, setNotes] = useState<Note[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [inputCategory, setInputCategory] = useState<Category>("할 일");
  const [filterCategory, setFilterCategory] = useState<Category | "전체">("전체");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [status, setStatus] = useState<string | null>(null);

  // hydration 에러 방지
  useEffect(() => setMounted(true), []);

  // Read: 데이터 불러오기 (LocalStorage 먼저, 그 다음 Google Sheets)
  useEffect(() => {
    // 1. 먼저 로컬 스토리지에서 불러오기
    const savedNotes = localStorage.getItem("postit_notes");
    if (savedNotes) {
      try {
        setNotes(JSON.parse(savedNotes));
      } catch (e) {
        console.error("로컬 스토리지 파싱 에러:", e);
      }
    }

    // 2. 구글 시트에서 최신 데이터 가져와 동기화
    const fetchNotes = async () => {
      if (!API_URL) {
        console.error("오류: API_URL이 비어있습니다. .env.local 설정을 확인하세요.");
        return;
      }
      
      console.log("데이터 동기화 시도 중... URL:", API_URL);
      setLoading(true);
      try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
          throw new Error(`HTTP Error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 데이터 정제 및 고유 ID 확보
        const formattedData = data
          .filter((item: any) => item.content) // 내용이 있는 것만
          .map((item: any, index: number) => {
            // 시트 데이터에 timestamp가 없으면 임시 생성
            const reliableId = item.timestamp || `temp-${Date.now()}-${index}`;
            return {
              id: reliableId,
              timestamp: reliableId,
              datetime: item.datetime || new Date().toLocaleString(),
              category: item.category || "기타",
              content: item.content,
              color: item.color || COLORS[0],
              rotation: Math.random() * 6 - 3
            };
          });

        // 클라우드 데이터가 있다면 로컬 데이터를 완전히 대체 (시트가 우선)
        if (formattedData.length > 0) {
          setNotes(formattedData);
          localStorage.setItem("postit_notes", JSON.stringify(formattedData));
          console.log("서버에서 최신 데이터를 성공적으로 불러왔습니다.");
        }
      } catch (error) {
        console.error("⚠️ 시트 연동 실패:", error);
        console.warn("해결 방법: 구글 앱 스크립트 배포 시 '액세스 권한: 모든 사용자'인지 확인하고, 브라우저의 광고 차단기를 꺼보세요.");
      } finally {
        setLoading(false);
      }
    };
    fetchNotes();
  }, []);

  // 로컬 상태가 바뀔 때마다 로컬 스토리지에 저장 (캐싱)
  useEffect(() => {
    if (notes.length > 0) {
      localStorage.setItem("postit_notes", JSON.stringify(notes));
    }
  }, [notes]);

  // Create: 메모 추가
  const addNote = async () => {
    if (!inputValue.trim()) return;

    setStatus("저장 중...");
    const now = new Date();
    const timestamp = Date.now();
    const newNote: Note = {
      id: timestamp,
      timestamp: timestamp,
      datetime: now.toLocaleString(),
      category: inputCategory,
      content: inputValue,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * 6 - 3,
    };

    // 로컬 상태 먼저 업데이트 (빠른 UI 반응)
    setNotes([newNote, ...notes]);
    setInputValue("");

    // 시트 동기화
    if (API_URL) {
      try {
        await fetch(API_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ 
            action: "create", 
            timestamp: timestamp.toString(), // 일관성을 위해 문자열로 전송
            datetime: newNote.datetime, 
            category: newNote.category, 
            content: newNote.content, 
            color: newNote.color 
          }),
        });
        console.log("시트 동기화 전송 완료");
      } catch (e) {
        console.error("동기화 실패", e);
      }
    }
  };

  // Delete: 메모 삭제
  const deleteNote = async (id: number | string) => {
    setStatus("삭제 중...");
    setNotes(notes.filter((note) => note.id !== id));
    
    if (API_URL) {
      try {
        await fetch(API_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ action: "delete", timestamp: id.toString() }),
        });
        setStatus("삭제 완료!");
        setTimeout(() => setStatus(null), 2000);
      } catch (e) {
        setStatus("삭제 실패");
        console.error("삭제 동기화 실패", e);
      }
    }
  };

  // Update: 메모 수정 완료
  const saveUpdate = async (id: number | string) => {
    const updatedNotes = notes.map(n => n.id === id ? { ...n, content: editValue } : n);
    setNotes(updatedNotes);
    const target = notes.find(n => n.id === id);

    setEditingId(null);

    if (API_URL && target) {
      setStatus("수정 중...");
      try {
        await fetch(API_URL, {
          method: "POST",
          mode: "no-cors",
          headers: { "Content-Type": "text/plain" },
          body: JSON.stringify({ 
            action: "update", 
            timestamp: id.toString(), 
            content: editValue,
            category: target.category 
          }),
        });
        setStatus("수정 완료!");
        setTimeout(() => setStatus(null), 2000);
      } catch (e) {
        setStatus("수정 실패");
        console.error("수정 동기화 실패", e);
      }
    }
  };

  const filteredNotes = filterCategory === "전체"
    ? notes
    : notes.filter(note => note.category === filterCategory);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#f3f4f6] dark:bg-zinc-950 p-8 font-sans transition-colors duration-300">
      <div className="max-w-4xl mx-auto relative">
        {/* 테마 전환 버튼 (우측 상단 플로팅) */}
        <div className="absolute top-0 right-0 z-50">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-full bg-white dark:bg-zinc-800 shadow-md hover:scale-110 transition-transform p-3 w-12 h-12"
          >
            {theme === "dark" ? (
              <Sun className="h-6 w-6 text-yellow-400" />
            ) : (
              <Moon className="h-6 w-6 text-blue-600" />
            )}
          </Button>
        </div>

        <header className="mb-12 text-center mt-10">
          <motion.h1
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="text-4xl font-extrabold text-gray-800 dark:text-zinc-100 mb-2"
          >
            Google Cloud Post-it
          </motion.h1>
          <p className="text-gray-500 dark:text-zinc-400 font-medium italic">당신의 메모는 구글 시트에 안전하게 보관됩니다.</p>
        </header>

        {/* 입력 및 필터링 */}
        <div className="flex flex-col gap-6 items-center mb-16">
          <div className="flex items-center gap-2 w-full max-w-xl bg-white dark:bg-zinc-900 p-2 rounded-2xl shadow-lg border border-gray-100 dark:border-zinc-800 ring-4 ring-white/50 dark:ring-zinc-900/50 focus-within:ring-green-400/30 transition-all">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl border-dashed border-2 flex gap-2 h-11 min-w-[100px] dark:bg-zinc-900 dark:border-zinc-700">
                  <Tag className="w-4 h-4 text-green-500" />
                  {inputCategory}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="rounded-xl p-2 dark:bg-zinc-900 dark:border-zinc-800 text-zinc-100">
                {CATEGORIES.map(cat => (
                  <DropdownMenuItem key={cat} onClick={() => setInputCategory(cat)} className="rounded-lg cursor-pointer">
                    {cat}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <Input
              type="text"
              placeholder="클라우드에 저장할 메모..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNote()}
              className="border-none focus-visible:ring-0 text-md px-4 flex-1 h-11 bg-transparent dark:text-white"
            />

            <Button onClick={addNote} className="rounded-xl px-6 bg-green-600 hover:bg-green-700 h-11 text-white">
              <Plus className="w-5 h-5 mr-1" /> 저장
            </Button>
          </div>

          {/* 필터 셀렉터 (드롭다운 대신 항상 보이는 버튼들로 수정) */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <span className="text-xs font-bold text-gray-400 dark:text-zinc-500 mr-2 flex items-center gap-1">
              <Filter className="w-3 h-3" /> 필터:
            </span>
            <div className="bg-white dark:bg-zinc-900 p-1 rounded-full border dark:border-zinc-800 shadow-sm flex gap-1">
              {["전체", ...CATEGORIES].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat as any)}
                  className={`
                    px-5 py-1.5 rounded-full text-sm font-bold transition-all duration-200
                    ${filterCategory === cat 
                      ? "bg-green-500 text-white shadow-md scale-105" 
                      : "text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800"}
                  `}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 메모 리스트 */}
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-10 pb-20 px-4">
          <AnimatePresence mode="popLayout">
            {filteredNotes.map((note) => (
              <motion.div
                key={note.id}
                layout
                initial={{ scale: 0.2, opacity: 0, rotate: -30 }}
                animate={{ scale: 1, opacity: 1, rotate: note.rotation }}
                exit={{ scale: 0.5, opacity: 0, rotate: 20 }}
                whileHover={{ scale: 1.05, zIndex: editingId === note.id ? 20 : 10 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <Card className={`${note.color} border-none shadow-[0_10px_25px_-5px_rgba(0,0,0,0.1)] hover:shadow-[0_20px_40px_-5px_rgba(0,0,0,0.2)] transition-shadow w-full aspect-square flex flex-col relative overflow-hidden group`}>
                  <div className="absolute top-0 left-0 right-0 h-5 bg-black/5"></div>

                  <CardContent className="flex-1 p-6 pt-10 text-gray-800 text-lg font-medium leading-relaxed break-words overflow-auto">
                    <div className="flex items-center gap-1.5 mb-3 opacity-60">
                      <Tag className="w-3 h-3" />
                      <span className="text-[11px] font-bold uppercase tracking-widest">
                        {note.category}
                      </span>
                    </div>
                    {editingId === note.id ? (
                      <textarea
                        className="w-full h-full bg-transparent border-none focus:ring-0 resize-none p-0"
                        autoFocus
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={() => saveUpdate(note.id)}
                      />
                    ) : (
                      note.content
                    )}
                  </CardContent>

                  <div className="px-5 py-4 mt-auto flex items-center justify-between">
                    <span className="text-[10px] font-bold bg-black/5 px-2 py-1 rounded-md text-black/40">
                      {note.datetime.split(',')[0]}
                    </span>
                    <div className="flex gap-1 transition-opacity">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => { setEditingId(note.id as any); setEditValue(note.content); }}
                        className="w-8 h-8 text-gray-500/40 hover:text-blue-500 hover:bg-black/5"
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => deleteNote(note.id)}
                        className="w-8 h-8 text-gray-500/40 hover:text-red-500 hover:bg-black/5"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="absolute bottom-0 right-0 w-12 h-12 bg-gradient-to-br from-transparent via-black/5 to-black/10 pointer-events-none"></div>
                </Card>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>

        {filteredNotes.length === 0 && !loading && (
          <div className="text-center py-24 border-2 border-dashed border-muted rounded-[40px] bg-white/20 dark:bg-white/5 text-muted-foreground transition-colors">
            아직 클라우드 메모가 없습니다. 첫 메모를 저장해 보세요!
          </div>
        )}

        {/* 상태 알림창 */}
        <AnimatePresence>
          {status && (
            <motion.div
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[100] bg-black text-white px-6 py-3 rounded-full shadow-2xl font-bold flex items-center gap-3 border border-white/20"
            >
              {status.includes("중") && <Loader2 className="w-4 h-4 animate-spin text-green-400" />}
              {status}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
