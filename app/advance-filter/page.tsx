
import FilteredContainer from "@/components/FilteredContainer";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function AdvanceFilterPage() {
    return (
        <main className="min-h-screen bg-slate-50">
            <div className="container mx-auto px-6 py-12 max-w-7xl">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12">
                    <div>
                        <h1 className="text-5xl font-bold text-slate-900 mb-3 tracking-tight">Filter Constructor</h1>
                        <p className="text-slate-600 font-medium text-lg">
                            Advanced search and filtering of creatives
                        </p>
                    </div>
                    <div className="mt-4 md:mt-0">
                        <Link href="/">
                            <Button
                                variant="ghost"
                                className="text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            >
                                <ArrowLeft className="h-5 w-5 mr-2" />
                                Back to Library
                            </Button>
                        </Link>
                    </div>
                </div>
                <FilteredContainer />
            </div>
        </main>
    );
}