import { User, Building2, Calendar, BookOpen, Globe, Hash, Sparkles, Clock, GraduationCap } from "lucide-react";
import SectionHeading from "../common/SectionHeading";
import type { Book } from "../../types";

interface BookOverviewProps {
  book: Book;
}

const BookOverview = ({ book }: BookOverviewProps) => {
  const details = [
    { icon: User, label: "Author", value: book.author },
    { icon: Building2, label: "Publisher", value: book.publisher },
    { icon: Calendar, label: "Published", value: book.published },
    { icon: BookOpen, label: "Pages", value: book.pages ? `${book.pages}` : undefined },
    { icon: Globe, label: "Language", value: book.language },
    { icon: Hash, label: "ISBN", value: book.isbn },
    { icon: Building2, label: "Condition", value: book.condition },
  ].filter((d) => d.value);

  return (
    <section className="bg-[#F5F2EA] pb-16">
      <div className="max-w-7xl mx-auto px-6">
        <div className="bg-white rounded-4xl p-8 lg:p-10 shadow-sm border border-amber-100 grid lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            <SectionHeading eyebrow="Overview" title="About This Book" className="mb-6" />
            <p className="text-slate-600 leading-8">{book.description}</p>

            <div className="flex flex-wrap gap-2 mt-6">
              {book.tags.map((tag) => (
                <span key={tag} className="px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm font-medium capitalize">
                  {tag}
                </span>
              ))}
            </div>

            {book.aiSummary?.difficulty && (
              <div className="mt-8 bg-amber-50/60 border border-amber-100 rounded-3xl p-6">
                <div className="flex items-center gap-2 text-amber-700 font-semibold mb-4">
                  <Sparkles size={16} />
                  AI Summary
                  <span className="text-[10px] font-normal text-slate-400 uppercase tracking-wide">AI-generated</span>
                </div>

                <ul className="space-y-2 mb-5">
                  {book.aiSummary.keyTakeaways.map((point) => (
                    <li key={point} className="flex gap-2 text-sm text-slate-700">
                      <span className="text-amber-500 mt-0.5">•</span>
                      {point}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap gap-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1">
                    <GraduationCap size={14} /> {book.aiSummary.difficulty}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock size={14} /> ~{book.aiSummary.readingTimeHours}h read
                  </span>
                </div>

                <p className="text-xs text-slate-500 mb-4">
                  <span className="font-medium text-slate-700">Best for:</span> {book.aiSummary.targetAudience}
                </p>

                <div className="flex flex-wrap gap-2">
                  {book.aiSummary.topicsCovered.map((topic) => (
                    <span key={topic} className="px-3 py-1 rounded-full bg-white border border-amber-200 text-amber-700 text-xs">
                      {topic}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-5">Book Details</h3>
            <div className="space-y-4">
              {details.map(({ icon: Icon, label, value }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                    <Icon size={18} className="text-amber-600" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="font-medium text-slate-800">{value}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default BookOverview;