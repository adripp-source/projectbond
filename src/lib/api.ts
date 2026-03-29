import { supabase } from "@/integrations/supabase/client";

export const api = {
  async analyzeWebsite(url: string, companyName?: string, scanId?: string) {
    const { data, error } = await supabase.functions.invoke("analyze-website", {
      body: { url, company_name: companyName, scan_id: scanId },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async analyzeMedia(companyName: string, socials?: {
    twitter?: string;
    linkedin?: string;
    facebook?: string;
    instagram?: string;
  }) {
    const { data, error } = await supabase.functions.invoke("analyze-media", {
      body: {
        company_name: companyName,
        social_twitter: socials?.twitter,
        social_linkedin: socials?.linkedin,
        social_facebook: socials?.facebook,
        social_instagram: socials?.instagram,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  },

  async generateFix(issueId: string, issueTitle: string, issueDescription: string, targetType: string) {
    const { data, error } = await supabase.functions.invoke("generate-fix", {
      body: {
        issue_id: issueId,
        issue_title: issueTitle,
        issue_description: issueDescription,
        target_type: targetType,
      },
    });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  },
};
