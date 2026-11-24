"use client";

import { RefreshCw } from "lucide-react";
import { refreshSiteCache } from "@/core/actions/settings";
import { useAction } from "../lib/use-action";
import { Button } from "../ui/button";
import { Tooltip } from "../ui/tooltip";

/** Clears the public site's content cache. Saving in the admin already does this. */
export function RefreshSiteButton() {
  const { run, isBusy } = useAction();
  return (
    <Tooltip content="Use after editing data directly in Supabase or re-running the seed. Saving here updates the site on its own.">
      <Button
        variant="secondary"
        pending={isBusy("refresh")}
        onClick={() => void run(() => refreshSiteCache(), { key: "refresh", success: "Live site refreshed", refresh: false })}
      >
        <RefreshCw aria-hidden />
        Refresh live site
      </Button>
    </Tooltip>
  );
}
