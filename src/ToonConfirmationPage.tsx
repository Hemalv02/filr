import React, { useState } from 'react';
import { ArrowLeft, Check, AlertCircle } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import type { ExtractedData } from './lib/gemini';

type MergeStrategy = 'overwrite-keep-rest' | 'overwrite-discard-rest' | 'keep-existing' | 'manual';

interface ToonConfirmationPageProps {
  importedData: Partial<ExtractedData>;
  existingData: Partial<ExtractedData>;
  onConfirm: (mergedData: ExtractedData) => void;
  onCancel: () => void;
}

export function ToonConfirmationPage({ 
  importedData, 
  existingData, 
  onConfirm, 
  onCancel 
}: ToonConfirmationPageProps) {
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>('overwrite-keep-rest');
  const [data, setData] = useState<Partial<ExtractedData>>({});
  
  // Function to merge data based on strategy
  const getMergedData = (strategy: MergeStrategy): Partial<ExtractedData> => {
    switch (strategy) {
      case 'overwrite-keep-rest':
        // Overwrite existing with imported, keep non-conflicting existing data
        const mergedKeep = { ...existingData };
        Object.entries(importedData).forEach(([key, value]) => {
          if (value && value !== "" && value !== "undefined" && value !== "null") {
            mergedKeep[key as keyof ExtractedData] = value;
          }
        });
        return mergedKeep;
      
      case 'overwrite-discard-rest':
        // Only use imported data, discard all existing data
        const mergedDiscard: Partial<ExtractedData> = {};
        Object.entries(importedData).forEach(([key, value]) => {
          if (value && value !== "" && value !== "undefined" && value !== "null") {
            mergedDiscard[key as keyof ExtractedData] = value;
          }
        });
        return mergedDiscard;
      
      case 'keep-existing':
        // Keep existing data, only add imported data for empty fields
        const mergedExisting = { ...existingData };
        Object.entries(importedData).forEach(([key, value]) => {
          const existingValue = existingData[key as keyof ExtractedData];
          if ((!existingValue || existingValue === "" || existingValue === "undefined" || existingValue === "null") &&
              value && value !== "" && value !== "undefined" && value !== "null") {
            mergedExisting[key as keyof ExtractedData] = value;
          }
        });
        return mergedExisting;
      
      case 'manual':
        // Return current state for manual editing
        return data;
      
      default:
        return { ...existingData, ...importedData };
    }
  };

  // Initialize data on mount
  React.useEffect(() => {
    setData(getMergedData('overwrite-keep-rest'));
  }, []);

  // Update data when strategy changes
  const handleStrategyChange = (strategy: MergeStrategy) => {
    setMergeStrategy(strategy);
    if (strategy !== 'manual') {
      setData(getMergedData(strategy));
    }
  };

  const handleChange = (field: keyof ExtractedData, value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  };

  const handleConfirm = () => {
    onConfirm(data as ExtractedData);
  };

  const renderField = (label: string, field: keyof ExtractedData, isImported: boolean, isConflict: boolean) => {
    const value = data[field] || '';
    const fieldName = String(field);
    return (
      <div key={field} className="space-y-2">
        <Label htmlFor={fieldName} className="flex items-center gap-2">
          {label}
          {isImported && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded">
              Imported
            </span>
          )}
          {isConflict && (
            <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded">
              Conflict
            </span>
          )}
        </Label>
        <Input
          id={fieldName}
          value={value}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange(field, e.target.value)}
          className={isConflict ? "border-amber-300 bg-amber-50/50" : isImported ? "border-blue-300 bg-blue-50/50" : ""}
        />
      </div>
    );
  };

  // Determine which fields were imported
  const isFieldImported = (field: keyof ExtractedData) => {
    const importedValue = importedData[field];
    return !!(importedValue && importedValue !== "" && importedValue !== "undefined" && importedValue !== "null");
  };

  // Determine if field has a conflict (both imported and existing have values)
  const isFieldConflict = (field: keyof ExtractedData) => {
    const importedValue = importedData[field];
    const existingValue = existingData[field];
    return !!(
      importedValue && importedValue !== "" && importedValue !== "undefined" && importedValue !== "null" &&
      existingValue && existingValue !== "" && existingValue !== "undefined" && existingValue !== "null" &&
      importedValue !== existingValue
    );
  };

  // Count conflicts
  const conflictCount = Object.keys(importedData).filter(key => isFieldConflict(key as keyof ExtractedData)).length;

  // Field groupings with labels
  const fieldGroups = [
    {
      title: "Personal Information",
      fields: [
        { key: "name_english", label: "Name (English)" },
        { key: "name_bengali", label: "Name (Bengali)" },
        { key: "date_of_birth", label: "Date of Birth" },
        { key: "birth_day", label: "Birth Day" },
        { key: "birth_month", label: "Birth Month" },
        { key: "birth_year", label: "Birth Year" },
        { key: "place_of_birth", label: "Place of Birth" },
        { key: "sex", label: "Sex" },
      ] as Array<{ key: keyof ExtractedData; label: string }>
    },
    {
      title: "Birth Certificate",
      fields: [
        { key: "birth_registration_number", label: "Birth Registration Number" },
        { key: "father_name_english", label: "Father's Name (English)" },
        { key: "father_name_bengali", label: "Father's Name (Bengali)" },
        { key: "mother_name_english", label: "Mother's Name (English)" },
        { key: "mother_name_bengali", label: "Mother's Name (Bengali)" },
      ] as Array<{ key: keyof ExtractedData; label: string }>
    },
    {
      title: "Address Information",
      fields: [
        { key: "permanent_address", label: "Permanent Address" },
        { key: "current_address", label: "Current Address" },
      ] as Array<{ key: keyof ExtractedData; label: string }>
    },
    {
      title: "Education",
      fields: [
        { key: "institution_name", label: "Institution Name" },
        { key: "education_board", label: "Education Board" },
        { key: "ssc_roll_number", label: "SSC Roll Number" },
        { key: "ssc_registration_number", label: "SSC Registration Number" },
        { key: "ssc_passing_year", label: "SSC Passing Year" },
      ] as Array<{ key: keyof ExtractedData; label: string }>
    },
    {
      title: "National ID",
      fields: [
        { key: "parent_nid_number", label: "NID Number" },
        { key: "parent_name", label: "Parent Name" },
        { key: "relation", label: "Relation" },
      ] as Array<{ key: keyof ExtractedData; label: string }>
    },
    {
      title: "Other IDs",
      fields: [
        { key: "passport_number", label: "Passport Number" },
        { key: "tin_number", label: "TIN Number" },
        { key: "driving_license_number", label: "Driving License Number" },
        { key: "utility_account_number", label: "Utility Account Number" },
      ] as Array<{ key: keyof ExtractedData; label: string }>
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              onClick={onCancel}
              variant="ghost"
              size="sm"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Confirm TOON Import
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Review and edit the imported data before loading it into the form
              </p>
            </div>
          </div>
          <Button
            onClick={handleConfirm}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirm & Load
          </Button>
        </div>

        {/* Merge Strategy Selection */}
        {conflictCount > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-amber-900">
                <AlertCircle className="w-5 h-5" />
                Data Conflicts Detected ({conflictCount} field{conflictCount !== 1 ? 's' : ''})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-amber-800 mb-4">
                The imported TOON file has data that conflicts with your existing form data.
                Choose how you want to handle these conflicts:
              </p>
              
              <div className="space-y-3">
                <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white/50 transition-colors"
                  style={{ borderColor: mergeStrategy === 'overwrite-keep-rest' ? '#3b82f6' : '#e5e7eb' }}>
                  <input
                    type="radio"
                    name="mergeStrategy"
                    value="overwrite-keep-rest"
                    checked={mergeStrategy === 'overwrite-keep-rest'}
                    onChange={(e) => handleStrategyChange(e.target.value as MergeStrategy)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Overwrite conflicts and keep the rest</div>
                    <div className="text-sm text-gray-600">Use imported data for conflicting fields, keep existing data for non-conflicting fields</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white/50 transition-colors"
                  style={{ borderColor: mergeStrategy === 'overwrite-discard-rest' ? '#3b82f6' : '#e5e7eb' }}>
                  <input
                    type="radio"
                    name="mergeStrategy"
                    value="overwrite-discard-rest"
                    checked={mergeStrategy === 'overwrite-discard-rest'}
                    onChange={(e) => handleStrategyChange(e.target.value as MergeStrategy)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Replace all with imported data</div>
                    <div className="text-sm text-gray-600">Discard all existing data and use only the imported TOON data</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white/50 transition-colors"
                  style={{ borderColor: mergeStrategy === 'keep-existing' ? '#3b82f6' : '#e5e7eb' }}>
                  <input
                    type="radio"
                    name="mergeStrategy"
                    value="keep-existing"
                    checked={mergeStrategy === 'keep-existing'}
                    onChange={(e) => handleStrategyChange(e.target.value as MergeStrategy)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Keep existing data for conflicts</div>
                    <div className="text-sm text-gray-600">Keep your existing data, only add imported data for empty fields</div>
                  </div>
                </label>

                <label className="flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer hover:bg-white/50 transition-colors"
                  style={{ borderColor: mergeStrategy === 'manual' ? '#3b82f6' : '#e5e7eb' }}>
                  <input
                    type="radio"
                    name="mergeStrategy"
                    value="manual"
                    checked={mergeStrategy === 'manual'}
                    onChange={(e) => handleStrategyChange(e.target.value as MergeStrategy)}
                    className="mt-1"
                  />
                  <div>
                    <div className="font-medium text-gray-900">Manual review and edit</div>
                    <div className="text-sm text-gray-600">Review all fields and manually edit any values below</div>
                  </div>
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Legend */}
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <span className="font-semibold">Blue highlighted fields</span> were imported from the TOON file.
            {conflictCount > 0 && (
              <>
                {' '}<span className="font-semibold text-amber-800">Amber highlighted fields</span> have conflicts between imported and existing data.
              </>
            )}
            {' '}You can edit any field before confirming.
          </p>
        </div>

        <div className="space-y-6">
          {fieldGroups.map((group) => {
            // Only show group if it has at least one field with data
            const hasData = group.fields.some(({ key }) => data[key]);
            if (!hasData) return null;

            return (
              <Card key={group.title}>
                <CardHeader>
                  <CardTitle>{group.title}</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.fields.map(({ key, label }) => {
                    if (!data[key]) return null;
                    return renderField(label, key, isFieldImported(key), isFieldConflict(key));
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
