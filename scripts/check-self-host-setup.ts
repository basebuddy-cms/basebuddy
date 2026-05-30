import {
  getBaseBuddyConfigSetupStatus,
  isBaseBuddyConfigSetupReady,
  type BaseBuddyConfigSetupSection,
} from "../src/lib/basebuddy-config/setup";

const shouldPrintJson = process.argv.includes("--json");

const printTextReport = ({
  configPath,
  sections,
}: {
  configPath: string;
  sections: BaseBuddyConfigSetupSection[];
}) => {
  console.log("BaseBuddy self-host setup check");
  console.log("");
  console.log(`App data: ${configPath}`);

  for (const section of sections) {
    console.log("");
    console.log(`${section.title}: ${section.status}`);

    for (const check of section.checks) {
      const value = check.value ? ` (${check.value})` : "";
      console.log(`- ${check.key}: ${check.status}${value}`);
    }
  }
};

const main = async () => {
  const status = await getBaseBuddyConfigSetupStatus({
    checkContentDatabase: true,
  });
  const ready = isBaseBuddyConfigSetupReady(status);

  if (shouldPrintJson) {
    console.log(JSON.stringify({ ready, sections: status.sections, status }, null, 2));
  } else {
    printTextReport(status);
  }

  process.exitCode = ready ? 0 : 1;
};

void main();
