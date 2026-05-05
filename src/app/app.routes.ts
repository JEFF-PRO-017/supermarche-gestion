// app.routes.ts
import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'caisse', pathMatch: 'full' },
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'caisse',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/caisse/caisse/caisse.component').then(m => m.CaisseComponent),
  },
  {
    path: 'recu/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/caisse/recu/recu.component').then(m => m.RecuComponent),
  },
  {
    path: 'catalogue',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/catalogue/catalogue.component').then(m => m.CatalogueComponent),
  },
  {
    path: 'historique',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/historique/historique/historique.component').then(m => m.HistoriqueComponent),
  },
  {
    path: 'users',
    canActivate: [authGuard, adminGuard],
    loadComponent: () =>
      import('./features/users/users-list/users-list.component').then(m => m.UsersListComponent),
  },
  {
    path: 'articles/nouveau',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/article-form-page/article-form-page.component')
        .then(m => m.ArticleFormPageComponent),
  },
  {
    path: 'articles/modifier/:code',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/articles/article-form-page/article-form-page.component')
        .then(m => m.ArticleFormPageComponent),
  },
  {
    path: 'seed',
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./features/seed/seed.component').then(m => m.SeedComponent),
  },
  { path: '**', redirectTo: 'caisse' },
];
