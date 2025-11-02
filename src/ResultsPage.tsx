import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";
import type { ExtractedData } from "./lib/gemini";

interface ResultsPageProps {
  data: ExtractedData;
  onBack: () => void;
}

export default function ResultsPage({ data: initialData, onBack }: ResultsPageProps) {
  const [data, setData] = useState<ExtractedData>(initialData);

  const handleFieldChange = (field: keyof ExtractedData, value: string | number) => {
    setData({ ...data, [field]: value });
  };

  const renderField = (label: string, field: keyof ExtractedData, type: "text" | "number" = "text") => {
    const value = data[field];
    if (value === undefined || value === null || value === "" || value === 0) return null;

    return (
      <div className="space-y-1.5">
        <Label htmlFor={field} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <Input
          id={field}
          type={type}
          value={value}
          onChange={(e) => handleFieldChange(field, type === "number" ? Number(e.target.value) : e.target.value)}
          className="h-9 text-sm"
        />
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-lg font-semibold">Extracted Information</h1>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
        <div className="max-w-4xl mx-auto space-y-4">
          {/* Birth Certificate Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Birth Certificate Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField("Name (English)", "name_english")}
              {renderField("Name (Bengali)", "name_bengali")}
              {renderField("Father's Name (English)", "father_name_english")}
              {renderField("Father's Name (Bengali)", "father_name_bengali")}
              {renderField("Mother's Name (English)", "mother_name_english")}
              {renderField("Mother's Name (Bengali)", "mother_name_bengali")}
              {renderField("Date of Birth", "date_of_birth")}
              {(data.birth_day || data.birth_month || data.birth_year) && (
                <div className="md:col-span-2">
                  <Label className="text-xs text-muted-foreground mb-1.5 block">Date Breakdown</Label>
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <Label htmlFor="birth_day" className="text-xs">Day</Label>
                      <Input
                        id="birth_day"
                        type="text"
                        value={data.birth_day}
                        onChange={(e) => handleFieldChange("birth_day", e.target.value)}
                        placeholder="DD"
                        maxLength={2}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth_month" className="text-xs">Month</Label>
                      <Input
                        id="birth_month"
                        type="text"
                        value={data.birth_month}
                        onChange={(e) => handleFieldChange("birth_month", e.target.value)}
                        placeholder="MM"
                        maxLength={2}
                        className="h-9 text-sm"
                      />
                    </div>
                    <div>
                      <Label htmlFor="birth_year" className="text-xs">Year</Label>
                      <Input
                        id="birth_year"
                        type="text"
                        value={data.birth_year}
                        onChange={(e) => handleFieldChange("birth_year", e.target.value)}
                        placeholder="YYYY"
                        maxLength={4}
                        className="h-9 text-sm"
                      />
                    </div>
                  </div>
                </div>
              )}
              {renderField("Place of Birth", "place_of_birth")}
              {renderField("Birth Registration Number", "birth_registration_number")}
              {renderField("Sex", "sex")}
              {renderField("Permanent Address", "permanent_address")}
            </CardContent>
          </Card>

          {/* Address Information */}
          {(data.current_address || data.utility_account_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Address & Utility Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Current Address", "current_address")}
                {renderField("Utility Account Number", "utility_account_number")}
              </CardContent>
            </Card>
          )}

          {/* Education Information */}
          {(data.education_board || data.ssc_roll_number || data.institution_name) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Education Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Institution Name", "institution_name")}
                {renderField("Education Board", "education_board")}
                {renderField("SSC Roll Number", "ssc_roll_number")}
                {renderField("SSC Registration Number", "ssc_registration_number")}
                {renderField("Passing Year", "ssc_passing_year")}
              </CardContent>
            </Card>
          )}

          {/* Parent/Spouse NID Information */}
          {(data.parent_nid_number || data.parent_name) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Parent/Spouse NID Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Name", "parent_name")}
                {renderField("NID Number", "parent_nid_number")}
                {renderField("Relation", "relation")}
              </CardContent>
            </Card>
          )}

          {/* Other Identification */}
          {(data.passport_number || data.tin_number || data.driving_license_number) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Other Identification</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {renderField("Passport Number", "passport_number")}
                {renderField("TIN Number", "tin_number")}
                {renderField("Driving License Number", "driving_license_number")}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Footer Button */}
      <div className="flex-shrink-0 p-4 border-t bg-background">
        <div className="max-w-4xl mx-auto">
          <Button onClick={onBack} className="w-full">
            Process New Documents
          </Button>
        </div>
      </div>
    </div>
  );
}
