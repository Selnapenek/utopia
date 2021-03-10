import { contentsToTree } from '../components/assets'
import {
  DefaultPackageJson,
  PersistentModel,
  persistentModelForProjectContents,
  StoryboardFilePath,
} from '../components/editor/store/editor-state'
import {
  getDefaultUIJsFile,
  getSamplePreviewFile,
  getSamplePreviewHTMLFile,
} from '../core/model/new-project-files'
import { directory } from '../core/model/project-file-utils'
import {
  ProjectContents,
  RevisionsState,
  textFile,
  textFileContents,
  unparsed,
} from '../core/shared/project-file-types'
import { getSampleComponentsFile, getUiBuilderUIJSFile } from './ui-builder-ui-js-file'

export const UI_BUILDER_PROJECT_ID = 'UI-BUILDER'

export function defaultProject(): PersistentModel {
  const projectContents: ProjectContents = {
    '/package.json': textFile(
      textFileContents(
        JSON.stringify(DefaultPackageJson, null, 2),
        unparsed,
        RevisionsState.BothMatch,
      ),
      null,
      0,
    ),
    '/src': directory(),
    [StoryboardFilePath]: getDefaultUIJsFile(),
    '/assets': directory(),
    '/public': directory(),
    '/src/index.js': getSamplePreviewFile(),
    '/public/index.html': getSamplePreviewHTMLFile(),
  }

  let persistentModel = persistentModelForProjectContents(contentsToTree(projectContents))
  return persistentModel
}

function uiBuilderProject(): PersistentModel {
  const projectContents: ProjectContents = {
    '/package.json': textFile(
      textFileContents(
        JSON.stringify(DefaultPackageJson, null, 2),
        unparsed,
        RevisionsState.BothMatch,
      ),
      null,
      0,
    ),
    '/src': directory(),
    [StoryboardFilePath]: getUiBuilderUIJSFile(),
    '/src/components.js': getSampleComponentsFile(),
    '/assets': directory(),
    '/public': directory(),
    '/src/index.js': getSamplePreviewFile(),
    '/public/index.html': getSamplePreviewHTMLFile(),
  }

  let persistentModel = persistentModelForProjectContents(contentsToTree(projectContents))
  return persistentModel
}

export interface SampleProject {
  name: string
  model: PersistentModel
}

export function isSampleProject(projectID: string): boolean {
  return sampleProjectForId(projectID) != null
}

export function sampleProjectForId(projectID: string): SampleProject | null {
  switch (projectID) {
    case UI_BUILDER_PROJECT_ID:
      return {
        name: projectID,
        model: uiBuilderProject(),
      }
    default:
      return null
  }
}
