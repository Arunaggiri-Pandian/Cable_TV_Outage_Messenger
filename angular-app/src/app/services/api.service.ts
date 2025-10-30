import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ApiService {

  constructor(private http: HttpClient) { }

  getPublicConfig(): Observable<any> {
    return this.http.get('/api/public_config');
  }

  getAreas(): Observable<any> {
    return this.http.get('/api/areas');
  }

  sendMessages(payload: any): Observable<any> {
    return this.http.post('/api/send', payload);
  }
}
