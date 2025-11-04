"use client";

import { Concert_One } from "next/font/google";
import { useState } from "react";

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

interface FilterPanelProps {
    onFiltersChange: (filters: FilterOptions) => void;
    availableOptions: {
        pageNames: string[];
        publisherPlatforms: string[];
        ctaTypes: string[];
        displayFormats: string[];
        conceptFormats: string[];
        realizationFormats: string[];
        topicFormats: string[];
        hookFormats: string[];
        characterFormats: string[];
    };
}

export default function FilterPanel({ onFiltersChange, availableOptions }: FilterPanelProps) {
    const [filters, setFilters] = useState<FilterOptions>({
        pageName: "",
        publisherPlatform: "",
        ctaType: "",
        displayFormat: "",
        dateRange: "",
        searchQuery: "",
        conceptFormat: "",
        realizationFormat: "",
        topicFormat: "",
        hookFormat: "",
        characterFormat: "",
    });

    const handleFilterChange = (key: keyof FilterOptions, value: string) => {
        const newFilters = { ...filters, [key]: value };
        setFilters(newFilters);
        onFiltersChange(newFilters);
    };

    const clearFilters = () => {
        const clearedFilters = {
            pageName: "",
            publisherPlatform: "",
            ctaType: "",
            displayFormat: "",
            dateRange: "",
            searchQuery: "",
            conceptFormat: "",
            realizationFormat: "",
            topicFormat: "",
            hookFormat: "",
            characterFormat: "",
        };
        setFilters(clearedFilters);
        onFiltersChange(clearedFilters);
    };

    return (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6 border border-slate-200">
            <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Filters</h2>
                <button
                    onClick={clearFilters}
                    className="text-sm text-slate-600 hover:text-slate-800 underline"
                >
                    Clear all
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Search */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Search
                    </label>
                    <input
                        type="text"
                        value={filters.searchQuery}
                        onChange={(e) => handleFilterChange("searchQuery", e.target.value)}
                        placeholder="Search by title or text..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900 placeholder-slate-400"
                    />
                </div>

                {/* Page Name */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Page Name
                    </label>
                    <select
                        value={filters.pageName}
                        onChange={(e) => handleFilterChange("pageName", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All pages</option>
                        {availableOptions.pageNames.map((name) => (
                            <option key={name} value={name}>
                                {name}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Publisher Platform */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Platform
                    </label>
                    <select
                        value={filters.publisherPlatform}
                        onChange={(e) => handleFilterChange("publisherPlatform", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All platforms</option>
                        {availableOptions.publisherPlatforms.map((platform) => (
                            <option key={platform} value={platform}>
                                {platform}
                            </option>
                        ))}
                    </select>
                </div>

                {/* CTA Type */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        CTA Type
                    </label>
                    <select
                        value={filters.ctaType}
                        onChange={(e) => handleFilterChange("ctaType", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All types</option>
                        {availableOptions.ctaTypes.map((type) => (
                            <option key={type} value={type}>
                                {type}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Display Format */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Display Format
                    </label>
                    <select
                        value={filters.displayFormat}
                        onChange={(e) => handleFilterChange("displayFormat", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All formats</option>
                        {availableOptions.displayFormats.map((format) => (
                            <option key={format} value={format}>
                                {format}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Date Range */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Creation Period
                    </label>
                    <select
                        value={filters.dateRange}
                        onChange={(e) => handleFilterChange("dateRange", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All time</option>
                        <option value="today">Today</option>
                        <option value="week">Last week</option>
                        <option value="month">Last month</option>
                        <option value="quarter">Last quarter</option>
                    </select>
                </div>
                {/* Concept Format */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Concept Format
                    </label>
                    <select
                        value={filters.conceptFormat}
                        onChange={(e) => handleFilterChange("conceptFormat", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All concepts </option>
                        {availableOptions.conceptFormats.map((format) => (
                            <option key={format} value={format}>
                                {format}
                            </option>
                        ))}
                    </select>
                </div>
                {/* Realization Format */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Realization Format
                    </label>
                    <select
                        value={filters.realizationFormat}
                        onChange={(e) => handleFilterChange("realizationFormat", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All realizations </option>
                        {availableOptions.realizationFormats.map((format) => (
                            <option key={format} value={format}>
                                {format}
                            </option>
                        ))}
                    </select>
                </div>
                {/* Topic Format */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Topic Format
                    </label>
                    <select
                        value={filters.topicFormat}
                        onChange={(e) => handleFilterChange("topicFormat", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All topics </option>
                        {availableOptions.topicFormats.map((format) => (
                            <option key={format} value={format}>
                                {format}
                            </option>
                        ))}
                    </select>
                </div>
                {/* Hook Format */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Hook Format
                    </label>
                    <select
                        value={filters.hookFormat}
                        onChange={(e) => handleFilterChange("hookFormat", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All hooks </option>
                        {availableOptions.hookFormats.map((format) => (
                            <option key={format} value={format}>
                                {format}
                            </option>
                        ))}
                    </select>
                </div>
                {/* Character Format */}
                <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                        Character Format
                    </label>
                    <select
                        value={filters.characterFormat}
                        onChange={(e) => handleFilterChange("characterFormat", e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-slate-900"
                    >
                        <option value="">All characters </option>
                        {availableOptions.characterFormats.map((format) => (
                            <option key={format} value={format}>
                                {format}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
    </div>
);}
