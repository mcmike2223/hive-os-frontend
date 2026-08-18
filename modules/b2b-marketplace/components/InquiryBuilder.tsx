"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { UploadCloud, FileText, BrainCircuit } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function InquiryBuilder() {
    const [template, setTemplate] = useState('custom');

    return (
        <Card className="max-w-2xl">
            <CardHeader>
                <CardTitle>Post a New Inquiry (RFQ)</CardTitle>
                <CardDescription>Detail your sourcing requirements or upload a document.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                
                {/* Smart Upload Area */}
                <div className="border border-primary/20 bg-primary/5 rounded-xl p-6 text-center space-y-3 border-dashed relative overflow-hidden group cursor-pointer hover:bg-primary/10 transition-colors">
                    <div className="absolute top-2 right-2 bg-primary text-primary-foreground text-[11px] px-2 py-1 rounded-full font-bold uppercase tracking-wide flex items-center gap-1">
                        <BrainCircuit className="h-3 w-3" /> AI Powered OCR
                    </div>
                    <UploadCloud className="h-8 w-8 mx-auto text-primary" />
                    <div>
                        <h4 className="font-semibold">Smart Document Upload</h4>
                        <p className="text-xs text-muted-foreground mt-1">Upload a PDF or Word spec sheet, and we'll auto-fill the form below.</p>
                    </div>
                </div>

                <div className="flex items-center gap-4 py-2">
                    <div className="h-px bg-border flex-1"></div>
                    <span className="text-xs text-muted-foreground uppercase font-bold tracking-widest">OR</span>
                    <div className="h-px bg-border flex-1"></div>
                </div>

                {/* RFQ Template Selector */}
                <div className="space-y-2">
                    <Label>RFQ Template</Label>
                    <Select value={template} onValueChange={setTemplate}>
                        <SelectTrigger>
                            <SelectValue placeholder="Select a Template" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="custom">Custom Requirement</SelectItem>
                            <SelectItem value="it_hardware">IT Hardware & Electronics</SelectItem>
                            <SelectItem value="construction">Construction Materials</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                <div className="space-y-2">
                    <Label>Product / Service Title</Label>
                    <Input placeholder="e.g. 500x Dell Latitude Laptops" />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input type="number" placeholder="100" />
                    </div>
                    <div className="space-y-2">
                        <Label>Delivery Date</Label>
                        <Input type="date" />
                    </div>
                </div>

                {template === 'it_hardware' && (
                    <div className="p-4 bg-muted/30 rounded-xl space-y-4 border">
                        <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">IT Hardware Specs</div>
                        <div className="space-y-2">
                            <Label>Minimum RAM (GB)</Label>
                            <Input placeholder="16" />
                        </div>
                        <div className="space-y-2">
                            <Label>Storage Required</Label>
                            <Input placeholder="512GB SSD" />
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label>Detailed Specifications</Label>
                    <Textarea placeholder="Describe the material, certification requirements, etc." rows={4} />
                </div>
                
                <Button className="w-full">Publish Inquiry to Marketplace</Button>
            </CardContent>
        </Card>
    );
}
