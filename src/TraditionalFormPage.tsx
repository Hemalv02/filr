import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import type { ExtractedData } from "./lib/gemini";

interface TraditionalFormPageProps {
  onBack: () => void;
  onSave: (data: ExtractedData) => void;
}

export default function TraditionalFormPage({ onBack, onSave }: TraditionalFormPageProps) {
  const [data, setData] = useState<Partial<ExtractedData>>({
    name_english: "",
    name_bengali: "",
    father_name_english: "",
    father_name_bengali: "",
    mother_name_english: "",
    mother_name_bengali: "",
    date_of_birth: "",
    birth_day: "",
    birth_month: "",
    birth_year: "",
    place_of_birth: "",
    birth_registration_number: "",
    sex: "",
    permanent_address: "",
    current_address: "",
    utility_account_number: "",
    education_board: "",
    ssc_roll_number: "",
    ssc_registration_number: "",
    ssc_passing_year: "",
    institution_name: "",
    parent_nid_number: "",
    parent_name: "",
    relation: "",
    passport_number: "",
    tin_number: "",
    driving_license_number: "",
  });

  const handleFieldChange = (field: keyof ExtractedData, value: string) => {
    setData({ ...data, [field]: value });
  };

  const handleSave = () => {
    // Filter out empty fields and save
    const filteredData = Object.entries(data).reduce((acc, [key, value]) => {
      if (value && value.trim() !== "") {
        acc[key as keyof ExtractedData] = value;
      }
      return acc;
    }, {} as Partial<ExtractedData>);

    // Check if at least some data is provided
    if (Object.keys(filteredData).length === 0) {
      alert("Please fill in at least some fields before saving.");
      return;
    }

    onSave(filteredData as ExtractedData);
  };

  const renderField = (label: string, field: keyof ExtractedData, placeholder?: string) => {
    return (
      <div className="space-y-1.5">
        <Label htmlFor={field} className="text-xs text-muted-foreground">
          {label}
        </Label>
        <Input
          id={field}
          type="text"
          value={data[field] || ""}
          onChange={(e) => handleFieldChange(field, e.target.value)}
          placeholder={placeholder}
          className="h-9 text-sm"
        />
      </div>
    );
  };

  return (
    <div className="h-screen w-full bg-background flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-lg font-semibold">Update Your Information</h1>
          </div>
          <Button onClick={handleSave} size="sm">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
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
              {renderField("Name (English)", "name_english", "Full name in English")}
              {renderField("Name (Bengali)", "name_bengali", "Full name in Bengali")}
              {renderField("Father's Name (English)", "father_name_english")}
              {renderField("Father's Name (Bengali)", "father_name_bengali")}
              {renderField("Mother's Name (English)", "mother_name_english")}
              {renderField("Mother's Name (Bengali)", "mother_name_bengali")}
              {renderField("Date of Birth", "date_of_birth", "DD/MM/YYYY")}
              
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground mb-1.5 block">Date Breakdown (Optional)</Label>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label htmlFor="birth_day" className="text-xs">Day</Label>
                    <Input
                      id="birth_day"
                      type="text"
                      value={data.birth_day || ""}
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
                      value={data.birth_month || ""}
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
                      value={data.birth_year || ""}
                      onChange={(e) => handleFieldChange("birth_year", e.target.value)}
                      placeholder="YYYY"
                      maxLength={4}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              </div>

              {renderField("Place of Birth", "place_of_birth")}
              {renderField("Birth Registration Number", "birth_registration_number")}
              {renderField("Sex", "sex", "Male/Female")}
              {renderField("Permanent Address", "permanent_address")}
            </CardContent>
          </Card>

          {/* Address & Utility Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Address & Utility Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField("Current Address", "current_address")}
              {renderField("Utility Account Number", "utility_account_number")}
            </CardContent>
          </Card>

          {/* Education Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Education Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField("Institution Name", "institution_name")}
              {renderField("Education Board", "education_board")}
              {renderField("SSC Roll Number", "ssc_roll_number")}
              {renderField("SSC Registration Number", "ssc_registration_number")}
              {renderField("Passing Year", "ssc_passing_year", "YYYY")}
            </CardContent>
          </Card>

          {/* Parent/Spouse NID Information */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Parent/Spouse NID Information</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderField("Name", "parent_name")}
              {renderField("NID Number", "parent_nid_number")}
              {renderField("Relation", "relation", "Father/Mother/Spouse")}
            </CardContent>
          </Card>

          {/* Other Identification */}
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
        </div>
      </div>

      {/* Footer Button */}
      <div className="flex-shrink-0 p-4 border-t bg-background">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Button onClick={onBack} variant="outline" className="flex-1">
            Cancel
          </Button>
          <Button onClick={handleSave} className="flex-1">
            <Save className="w-4 h-4 mr-2" />
            Save Information
          </Button>
        </div>
      </div>
    </div>
  );
}
