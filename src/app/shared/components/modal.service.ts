// core/services/modal.service.ts
import { Injectable, ApplicationRef, createComponent, EnvironmentInjector, Type, inject } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ModalService {
  private appRef   = inject(ApplicationRef);
  private injector = inject(EnvironmentInjector);

  open<T>(component: Type<T>, data?: any): Promise<any> {
    return new Promise(resolve => {
      // Conteneur DOM
      const wrapper = document.createElement('div');
      document.body.appendChild(wrapper);

      // Créer le composant dynamiquement
      const ref = createComponent(component, {
        environmentInjector: this.injector,
        hostElement: wrapper,
      });

      // Injecter data + close
      (ref.instance as any).data    = data;
      (ref.instance as any).closeModal = (result?: any) => {
        modal.hide();
        resolve(result);
        ref.destroy();
        wrapper.remove();
      };

      this.appRef.attachView(ref.hostView);

      // Init Bootstrap Modal
      const el    = wrapper.firstElementChild as HTMLElement;
      const modal = new (window as any).bootstrap.Modal(el, { backdrop: 'static' });
      modal.show();
g
      // Cleanup sur hide natif
      el.addEventListener('hidden.bs.modal', () => {
        resolve(undefined);
        ref.destroy();
        wrapper.remove();
      }, { once: true });
    });
  }
}