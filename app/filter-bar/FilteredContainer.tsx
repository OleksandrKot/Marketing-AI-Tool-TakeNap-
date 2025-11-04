"use client";

import { useState, useEffect } from "react";
import { AdCard } from "@/components/ad-card";
import FilterPanel from "@/app/filter-bar/components/FilterPanel";
import { getAds } from "@/app/actions";
import type { Ad } from "@/lib/types";

interface FilterOptions {
    pageName: string;
    publisherPlatform: string;
    ctaType: string;
    displayFormat: string;
    dateRange: string;
    searchQuery: string;
    conceptFormat: string;
    realizationFormat: string; 
    topicFormat: string;
    hookFormat: string;
    characterFormat: string;
}

interface FilteredContainerProps {
    initialPageName?: string
}

export default function FilteredContainer({ initialPageName = "" }: FilteredContainerProps) {
    const [ads, setAds] = useState<Ad[]>([]);
    const [filteredAds, setFilteredAds] = useState<Ad[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [availableOptions, setAvailableOptions] = useState({
        pageNames: [] as string[],
        publisherPlatforms: [] as string[],
        ctaTypes: [] as string[],
        displayFormats: [] as string[],
        conceptFormats: [] as string [],
        realizationFormats: [] as string [],
        topicFormats: [] as string [],
        hookFormats: [] as string [],
        characterFormats: [] as string [],
    });

    // Завантажуємо всі ads при ініціалізації
    useEffect(() => {
        const loadAds = async () => {
            try {
                const allAds = await getAds();
                setAds(allAds);
                
                // Створюємо доступні опції для фільтрів
                const pageNames = Array.from(new Set(allAds.map(ad => ad.page_name).filter(Boolean))).sort();
                const publisherPlatforms = Array.from(new Set(allAds.map(ad => ad.publisher_platform).filter(Boolean))).sort();
                const ctaTypes = Array.from(new Set(allAds.map(ad => ad.cta_type).filter(Boolean))).sort();
                const displayFormats = Array.from(new Set(allAds.map(ad => ad.display_format).filter(Boolean))).sort();
                const conceptFormats = Array.from(new Set(allAds.map(ad => ad.concept).filter((item): item is string => item !== null))).sort();
                const realizationFormats = Array.from(new Set(allAds.map(ad => ad.realisation).filter((item): item is string => item !== null))).sort();
                const topicFormats = Array.from(new Set(allAds.map(ad => ad.topic).filter((item): item is string => item !== null))).sort();
                const hookFormats = Array.from(new Set(allAds.map(ad => ad.hook).filter((item): item is string => item !== null))).sort();
                const characterFormats = Array.from(new Set(allAds.map(ad => ad.character).filter((item): item is string => item !== null))).sort();
                setAvailableOptions({
                    pageNames,
                    publisherPlatforms,
                    ctaTypes,
                    displayFormats,
                    conceptFormats,
                    realizationFormats,
                    topicFormats,
                    hookFormats,
                    characterFormats,
                });
                // Apply initial page filter if present
                if (initialPageName) {
                    const filteredByPage = allAds.filter((ad) => ad.page_name === initialPageName)
                    setFilteredAds(filteredByPage)
                } else {
                    setFilteredAds(allAds)
                }
            } catch (error) {
                console.error("Error loading ads:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadAds();
    }, []);

    const handleFiltersChange = (filters: FilterOptions) => {
        let filtered = [...ads];

        // Фільтр пошуку
        if (filters.searchQuery) {
            const query = filters.searchQuery.toLowerCase();
            filtered = filtered.filter(ad => 
                ad.title?.toLowerCase().includes(query) ||
                ad.text?.toLowerCase().includes(query) ||
                ad.page_name?.toLowerCase().includes(query)
            );
        }

        // Фільтр назви сторінки
        if (filters.pageName) {
            filtered = filtered.filter(ad => ad.page_name === filters.pageName);
        }

        // Фільтр платформи
        if (filters.publisherPlatform) {
            filtered = filtered.filter(ad => ad.publisher_platform === filters.publisherPlatform);
        }
        // Фільтр типу CTA
        if (filters.ctaType) {
            filtered = filtered.filter(ad => ad.cta_type === filters.ctaType);
        }

        // Фільтр формату відображення
        if (filters.displayFormat) {
            filtered = filtered.filter(ad => ad.display_format === filters.displayFormat);
        }

        // Фільтр концепції
        if (filters.conceptFormat) {
            filtered = filtered.filter(ad => ad.concept === filters.conceptFormat);
        }
        // Фільтр реалізації
        if (filters.realizationFormat) {
            filtered = filtered.filter(ad => ad.realisation === filters.realizationFormat);
        }
        // Фільтр теми
        if (filters.topicFormat) {
            filtered = filtered.filter(ad => ad.topic === filters.topicFormat);
        }
        // Фільтр хука
        if (filters.hookFormat) {
            filtered = filtered.filter(ad => ad.hook === filters.hookFormat);
        }
        // Фільтр персонажа
        if(filters.characterFormat) {
            filtered = filtered.filter(ad => ad.character === filters.characterFormat);
        }

        // Фільтр дати
        if (filters.dateRange) {
            const now = new Date();
            let startDate: Date;

            switch (filters.dateRange) {
                case "today":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "week":
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "month":
                    startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                    break;
                case "quarter":
                    startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                    break;
                default:
                    startDate = new Date(0);
            }

            filtered = filtered.filter(ad => {
                const adDate = new Date(ad.created_at);
                return adDate >= startDate;
            });
        }

        setFilteredAds(filtered);
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="relative">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
                    <div className="absolute inset-0 rounded-full border-2 border-slate-200"></div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <FilterPanel 
                onFiltersChange={handleFiltersChange}
                availableOptions={availableOptions}
                initialPageName={initialPageName}
            />
            
            {/* Результати */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="totalAds mb-6">
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">
                        Search Results
                    </h3>
                    <p className="text-slate-600">
                        Found: <span className="font-semibold text-slate-900">{filteredAds.length}</span> ads
                    </p>
                </div>

                {filteredAds.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
                            </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-slate-900 mb-2">
                            Nothing found
                        </h3>
                        <p className="text-slate-500">
                            Try changing search parameters or clearing filters.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredAds.map((ad) => (
                            <AdCard key={ad.id} ad={ad} from="advance-filter" />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
